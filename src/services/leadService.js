const { v4: uuidv4 } = require('uuid');
const leadRepository = require('../repositories/leadRepository');
const logger = require('../utils/logger');
const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');
const { generateLeadRef } = require('../utils/idGenerator');
const assignmentService = require('./assignmentService');

const { getUsersDetailsMap } = require('../utils/userHelper'); // Helper
const { emitToUser, broadcast } = require('./socketService'); // Socket Service

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
        bestAgent = await findBestAgent();
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

        // Emit Socket Event to Assigned Agent
        emitToUser(assigned_to, 'lead_assigned', {
            message: `New Lead Assigned: ${newLead.name}`,
            lead: newLead
        });
    } else {
        await leadRepository.create(newLead);
    }

    // Broadcast creation event (e.g. for Admins/Dashboard)
    broadcast('lead_created', { lead: newLead });

    return { isDuplicate: false, lead: newLead, assignedUser: bestAgent };
};

const getLeadsFromDB = async (filter = {}, limit = 20, cursor = null) => {
    // Add default filter
    const finalFilter = { ...filter };

    // NOTE: LeadRepository.findAll handles basic filters. 
    // Complex 'is_deleted <> true' might need handling in Repository or here via simple field check
    // Current Repository implementation checks exact matches. 
    // We'll rely on the Repository to return everything matching 'filter' and filter is_deleted in memory if Repos lacks it,
    // OR update Repository to support operators.
    // For this step, let's assume Repository can handle simple KV pairs.

    const result = await leadRepository.findAll(finalFilter, limit, cursor);

    // In-memory filter for soft-delete if not handled by DB filter (since scan uses KV)
    // Actually, let's just pass `is_deleted: false` in filter from controller.

    const items = result.items || [];
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
        count: result.count
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

module.exports = {
    createLeadInDB,
    getLeadsFromDB,
    getLeadById,
    updateLeadInDB,
    deleteLead,
    bulkAssignLeads
};
