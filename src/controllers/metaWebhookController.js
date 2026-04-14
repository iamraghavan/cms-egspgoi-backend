const axios = require('axios');
const logger = require('../utils/logger');
const leadService = require('../services/leadService');
const { normalizeMetaLead } = require('../utils/metaUtils');

/**
 * GET - Meta Webhook Verification
 * This is called by Meta when you first set up the webhook.
 */
const verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        logger.info('Webhook verified successfully');
        return res.status(200).send(challenge);
    }

    logger.warn('Webhook verification failed: Invalid token');
    return res.status(403).send('Verification failed');
};

/**
 * POST - Receive Leads from Meta
 * Receives lead generation events and processes them.
 */
const handleMetaLead = async (req, res) => {
    logger.info('Meta Lead Event Received');

    try {
        const changes = req.body.entry?.[0]?.changes?.[0]?.value;
        if (!changes || !changes.leadgen_id) {
            logger.warn('Meta Webhook: Missing leadgen_id in payload');
            return res.status(200).send('EVENT_RECEIVED');
        }

        // Meta Testing Tool often prefixes IDs with 'l:' 
        const leadId = changes.leadgen_id.replace(/^l:/, '');
        const formId = changes.form_id;
        const pageId = changes.page_id;

        logger.info(`Received Meta Lead: ID=${leadId}, FormID=${formId}, PageID=${pageId}`);

        // 1. Fetch lead details from Meta Graph API
        const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
        if (!ACCESS_TOKEN) {
            logger.error('Meta Webhook Error: META_ACCESS_TOKEN not configured in .env');
            return res.status(200).send('EVENT_RECEIVED');
        }

        // Using v24.0 for better compatibility
        const response = await axios.get(`https://graph.facebook.com/v24.0/${leadId}`, {
            params: { access_token: ACCESS_TOKEN }
        });

        const leadDetails = response.data;
        if (!leadDetails || !leadDetails.field_data) {
            logger.warn(`Meta Webhook: No field_data found for lead ${leadId}`);
            return res.status(200).send('EVENT_RECEIVED');
        }

        // 2. Normalize and Map to Schema
        const normalizedData = normalizeMetaLead(leadDetails.field_data);
        
        // Add Meta specific metadata
        normalizedData.meta_lead_id = leadId;
        normalizedData.form_id = formId;
        normalizedData.page_id = pageId;
        normalizedData.utm_params = {
            utm_source: 'fb',
            utm_medium: 'leadgen',
            utm_campaign: formId,
            meta_lead_id: leadId
        };

        logger.info(`Processing Meta Lead: ${normalizedData.name} (${normalizedData.phone})`);

        // 3. Save into DB (CRM table)
        const result = await leadService.createLeadInDB(normalizedData, true, 'META_WEBHOOK');

        if (result.isDuplicate) {
            logger.info(`Meta Lead ${leadId} is a duplicate. Logic skipped.`);
        } else {
            logger.info(`Meta Lead ${leadId} successfully stored and assigned.`);
        }

        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        logger.error('Error processing Meta Webhook:', error.response?.data || error.message);
        res.status(200).send('EVENT_RECEIVED');
    }
};

/**
 * POST - Receive Leads from Google Sheets
 * Receives flat row data and stores it in the DB.
 */
const handleGoogleSheetLead = async (req, res) => {
    logger.info('Google Sheet Lead Received');
    
    try {
        const rowData = req.body;
        
        // Basic normalization for Google Sheet headers (which might have spaces/lowercases)
        // Supported headers from user: id, created_time, course_interested, full_name, phone_number, city
        const normalizedData = {
            meta_lead_id: rowData.id || null,
            name: rowData.full_name || rowData.name || 'Sheet Lead',
            email: rowData.email || null,
            phone: rowData.phone_number || rowData.phone || null,
            course: rowData.course_interested || rowData.course || 'Unknown',
            district: rowData.city || rowData.district || null,
            state: rowData.state || null,
            admission_year: new Date().getFullYear().toString(),
            source_website: 'google_sheets',
            college: 'ADS',
            created_at: rowData.created_time || new Date().toISOString(),
            form_data: rowData
        };

        // Clean phone
        if (normalizedData.phone) {
            normalizedData.phone = normalizedData.phone.toString().replace(/^p:/, '');
            if (!normalizedData.phone.startsWith('+')) {
                normalizedData.phone = `+${normalizedData.phone}`;
            }
        }

        logger.info(`Processing Sheet Lead: ${normalizedData.name} (${normalizedData.phone})`);

        const result = await leadService.createLeadInDB(normalizedData, true, 'GOOGLE_SHEET_SYNC');

        if (result.isDuplicate) {
            logger.info(`Sheet Lead ${normalizedData.meta_lead_id} is a duplicate. Logic skipped.`);
        } else {
            logger.info(`Sheet Lead ${normalizedData.meta_lead_id} successfully stored.`);
        }

        res.status(200).json({ status: 'success', message: 'Lead stored' });
    } catch (error) {
        logger.error('Error processing Google Sheet Lead:', error.message);
        res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = {
    verifyWebhook,
    handleMetaLead,
    handleGoogleSheetLead
};


