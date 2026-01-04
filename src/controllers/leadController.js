const { schema: leadSchema } = require('../models/leadModel');
const logger = require('../utils/logger');
const Joi = require('joi');
const { clickToCall } = require('../services/smartfloService');
const leadService = require('../services/leadService');
const { getISTTimestamp } = require('../utils/timeUtils');
const { formatPhoneNumber, getNationalNumber } = require('../utils/phoneUtils');
const { getUserNamesMap } = require('../utils/userHelper');

const { sendSuccess, sendError } = require('../utils/responseUtils');

// 1. Create Lead (Internal)
const createLead = async (req, res) => {
    try {
        const { name, phone, email, pipeline_id, college, course, state, district, admission_year, source_website, utm_params } = req.body;

        // Validation
        const formattedPhone = formatPhoneNumber(phone);
        if (!formattedPhone) return sendError(res, { message: 'Invalid phone number format.' }, 'Validation', 400);

        req.body.phone = formattedPhone;
        const { error } = leadSchema.validate(req.body);
        if (error) return sendError(res, { message: error.details[0].message }, 'Validation', 400);

        const leadData = {
            name, phone: formattedPhone, email, pipeline_id, college, course, state, district,
            admission_year: admission_year || new Date().getFullYear().toString(),
            source_website: source_website || 'internal_dashboard',
            utm_params: utm_params || {}
        };

        const result = await leadService.createLeadInDB(leadData, true, req.user.id);

        sendSuccess(res, result.lead, 'Lead created successfully', 201);
    } catch (error) {
        sendError(res, error, 'Create Lead');
    }
};

// 2. Submit Lead (Public)
const submitLead = async (req, res) => {
    try {
        // Strict Validation Schema (Public)
        const submissionSchema = Joi.object({
            phone: Joi.string().required(),
            admission_year: Joi.string().required(),
            source_website: Joi.string().required(),
            name: Joi.string().required(),
            email: Joi.string().email().optional().allow(''),
            college: Joi.string().optional(),
            course: Joi.string().optional(),
            state: Joi.string().optional(),
            district: Joi.string().optional(),
            utm_source: Joi.string().optional(),
            utm_medium: Joi.string().optional(),
            utm_campaign: Joi.string().optional()
        }).unknown(true);

        const { error } = submissionSchema.validate(req.body);
        if (error) return sendError(res, { message: error.details[0].message }, 'Validation', 400);

        const { name, email, phone, college, course, state, district, admission_year, source_website, utm_source, utm_medium, utm_campaign, ...otherDetails } = req.body;

        const formattedPhone = formatPhoneNumber(phone);
        if (!formattedPhone) return sendError(res, { message: 'Invalid phone number format.' }, 'Validation', 400);

        const leadData = {
            name, email, phone: formattedPhone, college, course, state, district,
            admission_year, source_website,
            utm_params: { source: utm_source, medium: utm_medium, campaign: utm_campaign },
            form_data: otherDetails
        };

        const result = await leadService.createLeadInDB(leadData, false);

        if (result.isDuplicate) {
            return sendSuccess(res, { lead_id: result.lead.id }, 'Lead already exists.', 200);
        }

        const responseData = { lead_id: result.lead.id };
        const meta = {};
        let message = 'Lead submitted successfully';

        if (result.assignedUser) {
            responseData.assigned_user = {
                user_id: result.assignedUser.id,
                name: result.assignedUser.name,
                role: result.assignedUser.role_name,
                email: result.assignedUser.email,
                phone: result.assignedUser.phone
            };
            meta.assignment_strategy = 'weighted_equal_distribution';
            message = 'Lead submitted and assigned successfully';
        }

        sendSuccess(res, responseData, message, 201, meta);
    } catch (error) {
        sendError(res, error, 'Submit Lead');
    }
};

// ...
const { getPaginationParams, formatPaginationMeta } = require('../utils/paginationUtils');

// ...

// 3. Get Leads
const getLeads = async (req, res) => {
    try {
        const { limit, cursor, startDate, endDate } = getPaginationParams(req.query);

        const filter = {};
        if (req.user.role !== 'Super Admin' && req.user.role !== 'Admission Manager') {
            filter.assigned_to = req.user.id;
        }

        const result = await leadService.getLeadsFromDB(filter, limit, cursor, startDate, endDate);

        const meta = formatPaginationMeta(result.cursor, result.count, limit);
        sendSuccess(res, result.items, 'Leads fetched successfully', 200, meta);
    } catch (error) {
        sendError(res, error, 'Get Leads');
    }
};

// 4. Initiate Call
const initiateCall = async (req, res) => {
    try {
        const { id } = req.params;
        const agentNumber = req.user.agent_number || req.body.agent_number;

        if (!agentNumber) return sendError(res, { message: 'Agent number not found.' }, 'Initiate Call', 400);

        const callerId = req.user.caller_id || process.env.SMARTFLO_CALLER_ID || null;
        const lead = await leadService.getLeadById(id);

        if (!lead) return sendError(res, { message: 'Lead not found' }, 'Initiate Call', 404);

        const destinationNumber = getNationalNumber(lead.phone) || lead.phone;

        logger.info(`Initiating call for Lead ${id} to ${destinationNumber}`);
        await clickToCall(agentNumber, destinationNumber, callerId);

        sendSuccess(res, null, 'Call initiated successfully');
    } catch (error) {
        sendError(res, error, 'Initiate Call');
    }
};

// 5. Add Note
const addNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;
        if (!content) return sendError(res, { message: 'Content required' }, 'Add Note', 400);

        const { v4: uuidv4 } = require('uuid'); // Ensure uuid is imported

        const newNote = {
            note_id: uuidv4(),
            content,
            author_id: req.user.id,
            author_name: req.user.name || 'Unknown',
            author_role: req.user.role || 'User',
            author_email: req.user.email,
            created_at: getISTTimestamp()
        };

        const lead = await leadService.getLeadById(id);
        if (!lead) return sendError(res, { message: 'Lead not found' }, 'Add Note', 404);

        const updatedNotes = [...(lead.notes || []), newNote];
        await leadService.updateLeadInDB(id, { notes: updatedNotes });

        sendSuccess(res, { note: newNote }, 'Note added successfully');
    } catch (error) {
        sendError(res, error, 'Add Note');
    }
};

// 6. Transfer Lead
const transferLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_agent_id } = req.body;
        if (!new_agent_id) return sendError(res, { message: 'New Agent ID required' }, 'Transfer Lead', 400);

        const updated = await leadService.updateLeadInDB(id, { assigned_to: new_agent_id });
        if (!updated) return sendError(res, { message: 'Lead not found' }, 'Transfer Lead', 404);

        sendSuccess(res, null, 'Lead transferred successfully');
    } catch (error) {
        sendError(res, error, 'Transfer Lead');
    }
};

// 7. Update Status
const updateLeadStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        if (!status) return sendError(res, { message: 'Status required' }, 'Update Status', 400);

        const updated = await leadService.updateLeadInDB(id, { status });
        if (!updated) return sendError(res, { message: 'Lead not found' }, 'Update Status', 404);

        sendSuccess(res, { status }, 'Status updated successfully');
    } catch (error) {
        sendError(res, error, 'Update Lead Status');
    }
};

// 8. Delete Lead
const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query;

        if (type === 'hard' && req.user.role !== 'Super Admin') {
            return sendError(res, { message: 'Only Super Admin can hard delete.' }, 'Delete Lead', 403);
        }

        const result = await leadService.deleteLead(id, type);
        if (!result) return sendError(res, { message: 'Lead not found' }, 'Delete Lead', 404);

        sendSuccess(res, result, 'Lead deleted successfully');
    } catch (error) {
        sendError(res, error, 'Delete Lead');
    }
};

// 9. HEAD Lead
const headLead = async (req, res) => {
    try {
        const lead = await leadService.getLeadById(req.params.id);
        if (!lead || lead.is_deleted) return res.status(404).end();
        res.status(200).end();
    } catch (error) {
        res.status(500).end();
    }
};

// 10. OPTIONS
const optionsLead = (req, res) => {
    res.set('Allow', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
    res.status(204).end();
};

// 11. PUT Lead
const putLead = async (req, res) => {
    try {
        const updated = await leadService.updateLeadInDB(req.params.id, req.body);
        if (!updated) return sendError(res, { message: 'Lead not found' }, 'Put Lead', 404);
        sendSuccess(res, updated, 'Lead updated successfully');
    } catch (error) {
        sendError(res, error, 'Put Lead');
    }
};

// 12. Get Notes
const getLeadNotes = async (req, res) => {
    try {
        const lead = await leadService.getLeadById(req.params.id);
        if (!lead) return sendError(res, { message: 'Lead not found' }, 'Get Notes', 404);

        const notes = lead.notes || [];
        // Enrichment can stay in service or here. 
        // Keeping here for now as view-logic but leveraging helper.
        const userMap = await getUserNamesMap(notes.map(n => n.author_id));
        const enriched = notes.map(n => ({ ...n, author_name: userMap[n.author_id] || 'Unknown' }));

        sendSuccess(res, enriched, 'Notes fetched');
    } catch (error) {
        sendError(res, error, 'Get Lead Notes');
    }
};

// 13. Bulk Transfer
const bulkTransferLeads = async (req, res) => {
    try {
        const { lead_ids, new_agent_id } = req.body;

        if (!lead_ids || !Array.isArray(lead_ids) || lead_ids.length === 0) {
            return sendError(res, { message: 'lead_ids array is required' }, 'Bulk Transfer', 400);
        }
        if (!new_agent_id) {
            return sendError(res, { message: 'new_agent_id is required' }, 'Bulk Transfer', 400);
        }

        const result = await leadService.bulkAssignLeads(lead_ids, new_agent_id);

        sendSuccess(res, result, 'Bulk transfer completed');
    } catch (error) {
        sendError(res, error, 'Bulk Transfer');
    }
};

// 14. Get Lead By ID
const getLead = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await leadService.getLeadById(id);

        if (!lead || (lead.is_deleted && req.user.role !== 'Super Admin')) {
            return sendError(res, { message: 'Lead not found' }, 'Get Lead', 404);
        }

        // Enrich with assigned user details
        const { getUsersDetailsMap } = require('../utils/userHelper');
        let enrichedLead = { ...lead };

        if (lead.assigned_to) {
            const userMap = await getUsersDetailsMap([lead.assigned_to]);
            const assignedUser = userMap[lead.assigned_to];
            enrichedLead.assigned_user = assignedUser || null;
            enrichedLead.assigned_to_name = assignedUser ? assignedUser.name : null;
        }

        if (lead.created_by) {
            const userMap = await getUsersDetailsMap([lead.created_by]);
            const createdByUser = userMap[lead.created_by];
            enrichedLead.created_by_user = createdByUser || null;
            enrichedLead.created_by_name = createdByUser ? createdByUser.name : null;
        }

        sendSuccess(res, enrichedLead, 'Lead fetched successfully');
    } catch (error) {
        sendError(res, error, 'Get Lead');
    }
};

module.exports = {
    createLead, getLeads, initiateCall, submitLead, addNote, getLeadNotes,
    transferLead, updateLeadStatus, deleteLead, headLead, optionsLead, putLead,
    bulkTransferLeads, getLead
};
