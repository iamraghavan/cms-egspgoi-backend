const { v4: uuidv4 } = require('uuid');
const leadRepository = require('../repositories/leadRepository');
const logger = require('../utils/logger');
const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { generateLeadRef } = require('../utils/idGenerator');
const assignmentService = require('./assignmentService');

const { getUsersDetailsMap } = require('../utils/userHelper'); // Helper


// Use repository instead of direct DB calls
const createLeadInDB = async (leadData, isInternal = false, creatorId = null) => {
    // 1. Check Uniqueness (if public submission)
    if (!isInternal) {
        const existing = await leadRepository.findByEmailOrPhone(null, leadData.phone); // Strict check on phone
        if (existing) {
            // Also check admission year/source if needed, but repository is simpler for now.
            // If strictly needed, we can add logic here to compare other fields from 'existing'
            if (existing.admission_year === leadData.admission_year) {
                return { isDuplicate: true, lead: existing };
            }
        }
    }

    // 2. Auto-Assignment Logic
    let assigned_to = leadData.assigned_to;
    let bestAgent = null;

    if (!assigned_to) {
        // Only run auto-assignment algorithm if no specific agent is assigned
        bestAgent = await assignmentService.findBestAgent();
        if (bestAgent) {
            assigned_to = bestAgent.id;
            logger.info(`Auto-assigning lead to: ${bestAgent.name} (${bestAgent.id})`);
        } else if (isInternal && creatorId) {
            assigned_to = creatorId;
            logger.warn('No available agents. Assigning to creator.');
        } else {
            logger.warn('No available agents for public lead.');
            assigned_to = null;
        }
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
        is_deleted: false,
        created_at: timestamp,
        updated_at: timestamp
    };

    // 4. Persist
    // Use atomic transaction if auto-assigned via algorithm
    if (bestAgent && assigned_to === bestAgent.id) {
        await leadRepository.createWithAssignment(newLead, assigned_to);
        // Real-time notification removed
    } else {
        await leadRepository.create(newLead);
    }

    // Real-time broadcast removed

    return { isDuplicate: false, lead: newLead, assignedUser: bestAgent };
};

const getLeadsFromDB = async (filter = {}, limit = 20, cursor = null, startDate = null, endDate = null) => {
    // Add default filter
    const finalFilter = { ...filter };

    // NOTE: DynamoDB Scan returns pages. We can only sort/filter the retrieved page.
    const result = await leadRepository.findAll(finalFilter, limit, cursor);

    let items = result.items || [];

    // Date Filtering (In-Memory because DB format is custom string)
    if (startDate || endDate) {
        // Parse Filter Dates (Assuming input is YYYY-MM-DD or standard JS date)
        // If users send DD/MM/YYYY, we might need parsing. 
        // For now, assuming ISO string from frontend picker or compatible string.
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;

        // Adjust end date to end of day if only date is provided
        if (end) end.setHours(23, 59, 59, 999);

        items = items.filter(item => {
            const itemDate = parseISTTimestamp(item.created_at);
            if (start && itemDate < start) return false;
            if (end && itemDate > end) return false;
            return true;
        });
    }

    items.sort((a, b) => parseISTTimestamp(b.created_at) - parseISTTimestamp(a.created_at));

    // Enrich
    const userIds = items.map(t => t.assigned_to).concat(items.map(t => t.created_by));
    const userMap = await getUsersDetailsMap(userIds);

    const enrichedItems = items.map(item => {
        const assignedUser = userMap[item.assigned_to];
        const createdByUser = userMap[item.created_by];

        return {
            ...item,
            assigned_to_name: assignedUser ? assignedUser.name : null,
            created_by_name: createdByUser ? createdByUser.name : null,
            assigned_user: assignedUser || null,
            created_by_user: createdByUser || null
        };
    });

    return {
        items: enrichedItems,
        cursor: result.cursor,
        count: result.count // Note: This count is ScannedCount or PageCount, not Total Filtered Count
    };
};

const getLeadById = async (id) => {
    return await leadRepository.findById(id);
};

const updateLeadInDB = async (id, updateData) => {
    // Construct dynamic update for Repository
    // Repository expects: updateExpression, attrNames, attrValues
    // This logic is specific to DynamoDB, so arguably belongs in Repository. 
    // But Service prepares the business data.

    // Simplification: Use Repository's update method if we build the expression here
    // OR just use Fetch-Merge-Save pattern which relies on Repository.create (overwrite)

    const currentLead = await leadRepository.findById(id);
    if (!currentLead) return null;

    const updatedLead = {
        ...currentLead,
        ...updateData,
        updated_at: getISTTimestamp()
    };

    return await leadRepository.create(updatedLead); // Repository.create uses PutCommand (Overwrite)
};

const deleteLead = async (id, type = 'soft') => {
    if (type === 'hard') {
        await leadRepository.delete(id);
        return { message: 'Lead permanently deleted' };
    } else {
        const lead = await leadRepository.findById(id);
        if (!lead) return null;

        const softDeletedLead = {
            ...lead,
            is_deleted: true,
            deleted_at: getISTTimestamp()
        };
        await leadRepository.create(softDeletedLead);
        return { message: 'Lead soft deleted' };
    }
};

const bulkAssignLeads = async (leadIds, newAgentId) => {
    // 1. Verify New Agent Exists (Optional but good) - Skipping for speed/consistency with other methods or add check if needed.
    // For now, assuming caller knows valid UUID.

    // 2. Perform Parallel Updates
    // Since updateLeadInDB performs a Read-Modify-Write, parallelizing is efficient.
    const updatePromises = leadIds.map(id => updateLeadInDB(id, { assigned_to: newAgentId }));

    // 3. Wait for all
    // We could use allSettled to report partials, but for now Promise.all for simplicity
    const results = await Promise.all(updatePromises);

    // Filter out nulls (failed/not found)
    const successCount = results.filter(r => r).length;

    // Notify the Agent about bulk assignment
    if (successCount > 0) {
        emitToUser(newAgentId, 'bulk_lead_assigned', {
            message: `${successCount} New Leads Assigned via Bulk Transfer`,
            count: successCount
        });
    }

    return { successCount, total: leadIds.length };
};

// Fetch ALL leads for Export (Iterate over all pages)
const getAllLeadsFromDB = async (filter = {}, startDate = null, endDate = null) => {
    let allItems = [];
    let exclusiveStartKey = null;

    do {
        // limit=100 per internal fetch for better throughput
        const result = await leadRepository.findAll(filter, 100, exclusiveStartKey);

        let items = result.items || [];

        // Date Filter (In-Memory, if repo doesn't handle range)
        if (startDate || endDate) {
            const start = startDate ? new Date(startDate).getTime() : 0;
            const end = endDate ? new Date(endDate).getTime() : Date.now();
            items = items.filter(item => {
                const itemDate = new Date(item.created_at).getTime();
                return itemDate >= start && itemDate <= end;
            });
        }

        allItems = allItems.concat(items);
        exclusiveStartKey = result.cursor;

    } while (exclusiveStartKey); // Continue until no cursor

    // Sort by created_at desc (default)
    allItems.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    // Enrich
    const userIds = [...new Set(allItems.map(t => t.assigned_to).concat(allItems.map(t => t.created_by)).filter(Boolean))];
    const userMap = await getUsersDetailsMap(userIds);

    const enrichedItems = allItems.map(item => {
        const assignedUser = userMap[item.assigned_to];
        const createdByUser = userMap[item.created_by];

        return {
            ...item,
            assigned_to_name: assignedUser ? assignedUser.name : 'Unassigned',
            created_by_name: createdByUser ? createdByUser.name : 'System',
            assigned_user: assignedUser || null,
            created_by_user: createdByUser || null
        };
    });

    return enrichedItems;
};

module.exports = {
    createLeadInDB,
    getLeadsFromDB,
    getLeadById,
    updateLeadInDB,
    deleteLead,
    bulkAssignLeads,
    getAllLeadsFromDB
};
