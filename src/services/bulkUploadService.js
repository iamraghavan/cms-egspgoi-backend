const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { BatchWriteCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const logger = require('../utils/logger');
const { getISTTimestamp } = require('../utils/timeUtils');
const { generateLeadRef } = require('../utils/idGenerator');

/**
 * Service to handle Bulk Lead Upload
 */

// 1. Parse File
const parseFile = (buffer, mimetype) => {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return xlsx.utils.sheet_to_json(sheet);
};

// 2. Validate & Normalize Data
const normalizeLeads = (rawLeads) => {
    const validLeads = [];
    const errors = [];

    rawLeads.forEach((row, index) => {
        // Basic Validation
        if (!row.Phone || !row.Name || !row['Admission Year']) {
            errors.push({ row: index + 2, message: 'Missing required fields (Name, Phone, Admission Year)' });
            return;
        }

        // Normalize Phone (Remove spaces, dashes)
        const phone = String(row.Phone).replace(/\D/g, '');
        if (phone.length < 10) {
            errors.push({ row: index + 2, message: 'Invalid Phone Number' });
            return;
        }

        validLeads.push({
            name: row.Name,
            phone: phone,
            email: row.Email || '',
            college: row.College || '',
            course: row.Course || '',
            state: row.State || '',
            district: row.District || '',
            admission_year: String(row['Admission Year']),
            source_website: row['Source Website'] || 'bulk_upload',
            raw_row: index + 2
        });
    });

    return { validLeads, errors };
};

// 3. Deduplication (In-File & DB)
const filterDuplicates = async (leads) => {
    const uniqueLeads = [];
    const duplicates = [];
    const seenPhones = new Set();

    // In-File Dedup
    for (const lead of leads) {
        if (seenPhones.has(lead.phone)) {
            duplicates.push({ ...lead, reason: 'Duplicate in file' });
        } else {
            seenPhones.add(lead.phone);
            uniqueLeads.push(lead);
        }
    }

    // DB Dedup (Batch Check optimization)
    // Checking one by one is slow. Scanning all phones is memory heavy.
    // Best approach for bulk: Query in parallel batches or use a Bloom Filter (advanced).
    // Simple approach: Check existence for each unique lead using Promise.all with concurrency limit.
    
    const finalUniqueLeads = [];
    const batchSize = 50; // Concurrency limit
    
    for (let i = 0; i < uniqueLeads.length; i += batchSize) {
        const batch = uniqueLeads.slice(i, i + batchSize);
        
        const checks = batch.map(async (lead) => {
            // Use GSI if available, else Scan (fallback)
            // Assuming PhoneIndex exists as per previous tasks
            const params = {
                TableName: LEADS_TABLE,
                IndexName: "PhoneIndex",
                KeyConditionExpression: "phone = :phone",
                FilterExpression: "admission_year = :year",
                ExpressionAttributeValues: {
                    ":phone": lead.phone,
                    ":year": lead.admission_year
                }
            };
            
            try {
                // We need QueryCommand here, but we can't import it inside loop efficiently if not careful
                // Importing at top level
                const { QueryCommand } = require("@aws-sdk/lib-dynamodb");
                const command = new QueryCommand(params);
                const result = await docClient.send(command);
                
                if (result.Items && result.Items.length > 0) {
                    return { isDuplicate: true, lead };
                }
                return { isDuplicate: false, lead };
            } catch (err) {
                logger.error(`Dedup check failed for ${lead.phone}`, err);
                return { isDuplicate: false, lead }; // Assume unique on error to avoid data loss, or fail? Safe to assume unique and let DB constraint fail if any.
            }
        });

        const results = await Promise.all(checks);
        
        results.forEach(res => {
            if (res.isDuplicate) {
                duplicates.push({ ...res.lead, reason: 'Already exists in DB' });
            } else {
                finalUniqueLeads.push(res.lead);
            }
        });
    }

    return { uniqueLeads: finalUniqueLeads, duplicates };
};

// 4. Optimized Assignment
const assignLeadsBulk = async (leads) => {
    // Fetch all available agents
    const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
    const command = new ScanCommand({
        TableName: USERS_TABLE,
        FilterExpression: "(#role = :manager OR #role = :exec) AND is_available = :true",
        ExpressionAttributeNames: { "#role": "role" },
        ExpressionAttributeValues: {
            ":manager": "Admission Manager",
            ":exec": "Admission Executive",
            ":true": true
        }
    });

    const result = await docClient.send(command);
    const agents = result.Items || [];

    if (agents.length === 0) {
        // No agents available, assign to unassigned or creator?
        // Let's mark as unassigned
        return leads.map(l => ({ ...l, assigned_to: null }));
    }

    // Sort agents by workload
    agents.sort((a, b) => (a.active_leads_count || 0) - (b.active_leads_count || 0));

    const assignedLeads = [];
    const agentUpdates = {}; // Map agentId -> count increment

    let agentIndex = 0;
    for (const lead of leads) {
        const agent = agents[agentIndex];
        assignedLeads.push({ ...lead, assigned_to: agent.id });
        
        // Track update
        if (!agentUpdates[agent.id]) agentUpdates[agent.id] = 0;
        agentUpdates[agent.id]++;

        // Round Robin locally
        agentIndex = (agentIndex + 1) % agents.length;
    }

    // Bulk Update Agent Counters
    // We can't do one big batch update for counters, need individual updates
    // But we can run them in parallel
    const updatePromises = Object.keys(agentUpdates).map(agentId => {
        const increment = agentUpdates[agentId];
        return docClient.send(new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { id: agentId },
            UpdateExpression: "SET active_leads_count = if_not_exists(active_leads_count, :zero) + :inc, last_assigned_at = :now",
            ExpressionAttributeValues: {
                ":inc": increment,
                ":zero": 0,
                ":now": getISTTimestamp()
            }
        }));
    });

    await Promise.all(updatePromises);

    return assignedLeads;
};

// 5. Batch Insert
const batchInsertLeads = async (leads, creatorId) => {
    const BATCH_SIZE = 25;
    const timestamp = getISTTimestamp();
    
    // Prepare items
    const items = leads.map(lead => ({
        ...lead,
        id: uuidv4(),
        lead_reference_id: generateLeadRef(),
        status: 'new',
        created_at: timestamp,
        updated_at: timestamp,
        created_by: creatorId,
        notes: [], // Init empty notes
        utm_params: {}
    }));

    // Split into chunks
    const chunks = [];
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
        chunks.push(items.slice(i, i + BATCH_SIZE));
    }

    // Execute Batch Writes
    const writePromises = chunks.map(chunk => {
        const putRequests = chunk.map(item => ({
            PutRequest: {
                Item: item
            }
        }));

        return docClient.send(new BatchWriteCommand({
            RequestItems: {
                [LEADS_TABLE]: putRequests
            }
        }));
    });

    await Promise.all(writePromises);
    
    return items.length;
};

// Main Process Function
const processBulkUpload = async (fileBuffer, mimetype, creatorId) => {
    logger.info('Starting bulk upload process...');
    
    // 1. Parse
    const rawLeads = parseFile(fileBuffer, mimetype);
    logger.info(`Parsed ${rawLeads.length} rows.`);

    // 2. Normalize & Validate
    const { validLeads, errors } = normalizeLeads(rawLeads);
    if (validLeads.length === 0) {
        return { success: false, message: 'No valid leads found', errors };
    }

    // 3. Filter Duplicates
    const { uniqueLeads, duplicates } = await filterDuplicates(validLeads);
    logger.info(`Unique leads to process: ${uniqueLeads.length}`);

    if (uniqueLeads.length === 0) {
        return { 
            success: true, 
            message: 'All leads were duplicates', 
            stats: { total: rawLeads.length, inserted: 0, duplicates: duplicates.length, errors: errors.length } 
        };
    }

    // 4. Assign
    const assignedLeads = await assignLeadsBulk(uniqueLeads);

    // 5. Insert
    const insertedCount = await batchInsertLeads(assignedLeads, creatorId);

    return {
        success: true,
        message: 'Bulk upload completed',
        stats: {
            total: rawLeads.length,
            inserted: insertedCount,
            duplicates: duplicates.length,
            errors: errors.length
        },
        errors: errors.concat(duplicates.map(d => ({ row: d.raw_row, message: d.reason })))
    };
};

module.exports = { processBulkUpload };
