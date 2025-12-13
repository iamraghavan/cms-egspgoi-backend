const { schema: leadSchema } = require('../models/leadModel');
const logger = require('../utils/logger');
const Joi = require('joi');
const { clickToCall } = require('../services/smartfloService');
const leadService = require('../services/leadService');
const { getISTTimestamp } = require('../utils/timeUtils');
const { formatPhoneNumber } = require('../utils/phoneUtils');
const { getUserNamesMap } = require('../utils/userHelper');

// Standardized Error Response
const handleError = (res, error, context) => {
    logger.error(`${context} Error:`, error);
    res.status(500).json({ message: 'Internal Server Error', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
};

// 1. Create Lead (Internal)
const createLead = async (req, res) => {
    try {
        const { name, phone, email, pipeline_id, college, course, state, district, admission_year, source_website, utm_params } = req.body;

        // Normalize Phone
        const formattedPhone = formatPhoneNumber(phone);
        if (!formattedPhone) {
            return res.status(400).json({ message: 'Invalid phone number format.' });
        }

        // Update body for validation (since Joi expects E.164 now)
        req.body.phone = formattedPhone;

        // Validate Input
        const { error } = leadSchema.validate(req.body);
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const leadData = {
            name, phone: formattedPhone, email, pipeline_id, college, course, state, district,
            admission_year: admission_year || new Date().getFullYear().toString(),
            source_website: source_website || 'internal_dashboard',
            utm_params: utm_params || {}
        };

        const result = await leadService.createLeadInDB(leadData, true, req.user.id);
        
        res.status(201).json(result.lead);
    } catch (error) {
        handleError(res, error, 'Create Lead');
    }
};

// 2. Submit Lead (Public)
const submitLead = async (req, res) => {
    try {
        // Strict Input Validation for Public API
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
        if (error) {
            return res.status(400).json({ message: error.details[0].message });
        }

        const { 
            name, email, phone, college, course, state, district, 
            admission_year, source_website, 
            utm_source, utm_medium, utm_campaign,
            ...otherDetails 
        } = req.body;

        // Normalize Phone
        const formattedPhone = formatPhoneNumber(phone);
        if (!formattedPhone) {
            return res.status(400).json({ message: 'Invalid phone number format.' });
        }

        const leadData = {
            name, email, phone: formattedPhone, college, course, state, district,
            admission_year, source_website,
            utm_params: { source: utm_source, medium: utm_medium, campaign: utm_campaign },
            form_data: otherDetails
        };

        const result = await leadService.createLeadInDB(leadData, false);

        if (result.isDuplicate) {
            return res.status(200).json({ message: 'Lead already exists.', lead_id: result.lead.id });
        }

        res.status(201).json({ message: 'Lead submitted successfully', lead_id: result.lead.id });
    } catch (error) {
        handleError(res, error, 'Submit Lead');
    }
};

// 3. Get Leads (Paginated)
const getLeads = async (req, res) => {
    try {
        const { limit, lastEvaluatedKey } = req.query;
        const filter = {};

        // Security: Enforce data scoping
        if (req.user.role !== 'Super Admin' && req.user.role !== 'Admission Manager') {
            filter.assigned_to = req.user.id;
        }

        const result = await leadService.getLeadsFromDB(
            filter, 
            parseInt(limit) || 20, 
            lastEvaluatedKey ? JSON.parse(decodeURIComponent(lastEvaluatedKey)) : null
        );

        res.json(result);
    } catch (error) {
        handleError(res, error, 'Get Leads');
    }
};

// 4. Initiate Call
const initiateCall = async (req, res) => {
    try {
        const { id } = req.params;
        // Security: Prefer agent number from user profile
        const agentNumber = req.user.smartflo_agent_id || req.body.agent_number;

        if (!agentNumber) {
            return res.status(400).json({ message: 'Agent number not found in profile or request.' });
        }

        const callerId = process.env.SMARTFLO_CALLER_ID;
        if (!callerId) {
            return res.status(500).json({ message: 'System configuration error: Caller ID not set.' });
        }

        const lead = await leadService.getLeadById(id);
        if (!lead) {
            return res.status(404).json({ message: 'Lead not found' });
        }

        logger.info(`Initiating call for Lead ${id} to ${lead.phone} by Agent ${agentNumber}`);
        await clickToCall(agentNumber, lead.phone, callerId);

        res.json({ message: 'Call initiated successfully' });
    } catch (error) {
        handleError(res, error, 'Initiate Call');
    }
};

// 5. Add Note
const addNote = async (req, res) => {
    try {
        const { id } = req.params;
        const { content } = req.body;

        if (!content) return res.status(400).json({ message: 'Note content is required' });

        const lead = await leadService.getLeadById(id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        const newNote = {
            content,
            author_id: req.user.id,
            author_name: req.user.name || 'Unknown',
            created_at: getISTTimestamp()
        };

        const updatedNotes = [...(lead.notes || []), newNote];
        await leadService.updateLeadInDB(id, { notes: updatedNotes });

        res.json({ message: 'Note added successfully', note: newNote });
    } catch (error) {
        handleError(res, error, 'Add Note');
    }
};

// 6. Transfer Lead
const transferLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { new_agent_id } = req.body;

        if (!new_agent_id) return res.status(400).json({ message: 'New Agent ID is required' });

        const lead = await leadService.getLeadById(id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        await leadService.updateLeadInDB(id, { assigned_to: new_agent_id });

        res.json({ message: 'Lead transferred successfully' });
    } catch (error) {
        handleError(res, error, 'Transfer Lead');
    }
};

// 7. Update Status
const updateLeadStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) return res.status(400).json({ message: 'Status is required' });

        const lead = await leadService.getLeadById(id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        await leadService.updateLeadInDB(id, { status });

        res.json({ message: 'Lead status updated successfully', status });
    } catch (error) {
        handleError(res, error, 'Update Lead Status');
    }
};

// 8. Delete Lead (Soft/Hard)
const deleteLead = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.query; // 'hard' or 'soft' (default)

        // Security: Only Admin can hard delete
        if (type === 'hard' && req.user.role !== 'Super Admin') {
            return res.status(403).json({ message: 'Only Super Admin can perform hard deletes.' });
        }

        const result = await leadService.deleteLead(id, type);
        if (!result) return res.status(404).json({ message: 'Lead not found' });

        res.json(result);
    } catch (error) {
        handleError(res, error, 'Delete Lead');
    }
};

// 9. HEAD Lead (Check Existence)
const headLead = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await leadService.getLeadById(id);
        if (!lead || lead.is_deleted) {
            return res.status(404).end();
        }
        res.status(200).end();
    } catch (error) {
        res.status(500).end();
    }
};

// 10. OPTIONS Lead (Allowed Methods)
const optionsLead = (req, res) => {
    res.set('Allow', 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS');
    res.status(204).end();
};

// 11. PUT Lead (Full Update)
const putLead = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedLead = await leadService.updateLeadInDB(id, req.body);
        if (!updatedLead) return res.status(404).json({ message: 'Lead not found' });

        res.json(updatedLead);
    } catch (error) {
        handleError(res, error, 'Put Lead');
    }
};

const getLeadNotes = async (req, res) => {
    try {
        const { id } = req.params;
        const lead = await leadService.getLeadById(id);
        if (!lead) return res.status(404).json({ message: 'Lead not found' });

        const notes = lead.notes || [];
        if (notes.length === 0) return res.json([]);

        // Enrich with Author Names
        const authorIds = notes.map(n => n.author_id);
        const userMap = await getUserNamesMap(authorIds);

        const enrichedNotes = notes.map(note => ({
            ...note,
            author_name: userMap[note.author_id] || 'Unknown' 
        }));

        res.json(enrichedNotes);
    } catch (error) {
        handleError(res, error, 'Get Lead Notes');
    }
};

module.exports = { 
    createLead, 
    getLeads, 
    initiateCall, 
    submitLead, 
    addNote, 
    getLeadNotes,
    transferLead, 
    updateLeadStatus,
    deleteLead,
    headLead,
    optionsLead,
    putLead
};
