const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, ScanCommand, GetCommand, QueryCommand, TransactWriteItemsCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const logger = require('../utils/logger');
const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { generateLeadRef } = require('../utils/idGenerator');
const { findBestAgent } = require('./assignmentService');

/**
 * Service to handle Lead Business Logic and DB Operations
 */

// Helper: Find existing lead by phone (Uniqueness Check)
const findExistingLead = async (phone, admission_year, source_website) => {
    try {
        // Optimization: Use GSI 'PhoneIndex' for O(1) lookup
        const command = new QueryCommand({
            TableName: LEADS_TABLE,
            IndexName: "PhoneIndex",
            KeyConditionExpression: "phone = :phone",
            FilterExpression: "admission_year = :year AND source_website = :source",
            ExpressionAttributeValues: {
                ":phone": phone,
                ":year": admission_year,
                ":source": source_website
            }
        });
        
        const result = await docClient.send(command);
        return result.Items[0];
    } catch (error) {
        // Fallback to Scan if GSI doesn't exist (Migration safety)
        if (error.name === 'ValidationException' || error.name === 'ResourceNotFoundException') {
            logger.warn('PhoneIndex GSI not found, falling back to Scan.');
            const command = new ScanCommand({
                TableName: LEADS_TABLE,
                FilterExpression: "phone = :phone AND admission_year = :year AND source_website = :source",
                ExpressionAttributeValues: {
                    ":phone": phone,
                    ":year": admission_year,
                    ":source": source_website
                }
            });
            const result = await docClient.send(command);
            return result.Items[0];
        }
        throw error;
    }
};

// Create Lead (Internal or External)
const createLeadInDB = async (leadData, isInternal = false, creatorId = null) => {
    // 1. Check Uniqueness (if public submission)
    if (!isInternal) {
        const existing = await findExistingLead(leadData.phone, leadData.admission_year, leadData.source_website);
        if (existing) {
            return { isDuplicate: true, lead: existing };
        }
    }

    // 2. Auto-Assignment Logic
    let assigned_to = leadData.assigned_to;
    
    // If not manually assigned (or if we want to force auto-assignment logic)
    // For internal: default to creator if not specified, but here we override with auto-assignment as per requirement
    // For external: assigned_to is null initially
    
    // We try to find the best agent
    const bestAgent = await findBestAgent();
    if (bestAgent) {
        assigned_to = bestAgent.id;
        logger.info(`Auto-assigning lead to: ${bestAgent.name} (${bestAgent.id})`);
    } else if (isInternal && creatorId) {
        assigned_to = creatorId; // Fallback to creator for internal
        logger.warn('No available agents. Assigning to creator.');
    } else {
        logger.warn('No available agents for public lead.');
        assigned_to = null; // Unassigned
    }

    // 3. Prepare Lead Object
    const id = uuidv4();
    const lead_reference_id = generateLeadRef();
    const timestamp = getISTTimestamp();

    const newLead = {
        ...leadData,
        id,
        lead_reference_id,
        assigned_to,
        status: 'new',
        created_at: timestamp,
        updated_at: timestamp
    };

    // 4. Transaction: Create Lead + Update Agent Stats
    const transactItems = [
        {
            Put: {
                TableName: LEADS_TABLE,
                Item: newLead
            }
        }
    ];

    if (bestAgent) {
        transactItems.push({
            Update: {
                TableName: USERS_TABLE,
                Key: { id: bestAgent.id },
                UpdateExpression: "SET active_leads_count = if_not_exists(active_leads_count, :zero) + :inc, last_assigned_at = :now",
                ExpressionAttributeValues: {
                    ":inc": 1,
                    ":zero": 0,
                    ":now": timestamp
                }
            }
        });
    }

    await docClient.send(new TransactWriteItemsCommand({ TransactItems: transactItems }));
    
    return { isDuplicate: false, lead: newLead };
};

// Get Leads with Pagination
const getLeadsFromDB = async (filter = {}, limit = 20, lastEvaluatedKey = null) => {
    // Basic Scan with Pagination
    // In a real high-scale app, we should use Query on Indexes (e.g., by Status, by Agent)
    // For now, we Scan with Limit
    
    const params = {
        TableName: LEADS_TABLE,
        Limit: limit
    };

    if (lastEvaluatedKey) {
        params.ExclusiveStartKey = lastEvaluatedKey;
    }

    // Apply Filter (e.g., assigned_to)
    if (filter.assigned_to) {
        params.FilterExpression = "assigned_to = :assigned_to";
        params.ExpressionAttributeValues = { ":assigned_to": filter.assigned_to };
    }

    const command = new ScanCommand(params);
    const result = await docClient.send(command);

    // Sort in memory for the current page (Best effort without GSI)
    // Note: Global sorting requires GSI
    const items = result.Items || [];
    items.sort((a, b) => parseISTTimestamp(b.created_at) - parseISTTimestamp(a.created_at));

    return {
        items,
        lastEvaluatedKey: result.LastEvaluatedKey
    };
};

const getLeadById = async (id) => {
    const command = new GetCommand({
        TableName: LEADS_TABLE,
        Key: { id }
    });
    const result = await docClient.send(command);
    return result.Item;
};

const updateLeadInDB = async (id, updateData) => {
    // Construct Update Expression dynamically
    // This is a simplified version. For complex objects, we might need more logic.
    const itemKeys = Object.keys(updateData);
    if (itemKeys.length === 0) return null;

    let updateExpression = "SET updated_at = :now";
    const expressionAttributeValues = { ":now": getISTTimestamp() };
    const expressionAttributeNames = {};

    itemKeys.forEach((key, index) => {
        const attrName = `#attr${index}`;
        const attrVal = `:val${index}`;
        updateExpression += `, ${attrName} = ${attrVal}`;
        expressionAttributeNames[attrName] = key;
        expressionAttributeValues[attrVal] = updateData[key];
    });

    const command = new PutCommand({ // Using Put to overwrite/merge is safer for full updates, but Update is better for partial
        // Actually, let's use UpdateCommand for partial updates
        // But we need to be careful with syntax.
        // Let's stick to the pattern used in controller: Fetch -> Merge -> Put
        // Or properly build UpdateCommand.
        // Given the complexity of dynamic UpdateExpression, Fetch+Put is often easier to maintain for simple objects, 
        // but Update is better for concurrency.
        // Let's use the Fetch + Put pattern for consistency with previous code, 
        // OR implement a proper dynamic update builder.
        // Let's try the dynamic builder approach above, but we need UpdateCommand import.
        // Wait, I didn't import UpdateCommand. Let's add it.
    });
    
    // Re-implementing using Fetch + Put for safety and consistency with existing codebase patterns
    const currentLead = await getLeadById(id);
    if (!currentLead) return null;

    const updatedLead = {
        ...currentLead,
        ...updateData,
        updated_at: getISTTimestamp()
    };

    await docClient.send(new PutCommand({
        TableName: LEADS_TABLE,
        Item: updatedLead
    }));

    return updatedLead;
};

module.exports = {
    findExistingLead,
    createLeadInDB,
    getLeadsFromDB,
    getLeadById,
    updateLeadInDB
};
