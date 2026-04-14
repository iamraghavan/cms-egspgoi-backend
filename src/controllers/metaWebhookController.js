const axios = require('axios');
const logger = require('../utils/logger');
const leadService = require('../services/leadService');

// Verify Token from environment


/**
 * GET - Meta Webhook Verification
 * This is called by Meta when you first set up the webhook.
 */
const verifyWebhook = (req, res) => {
    const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;

    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    console.log("Mode:", mode);
    console.log("Token:", token);
    console.log("Verify Token:", VERIFY_TOKEN);

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
        console.log("Webhook verified");
        return res.status(200).send(challenge);
    }

    return res.status(403).send("Verification failed");
};

/**
 * POST - Receive Leads from Meta
 * Receives lead generation events and processes them.
 */
const handleMetaLead = async (req, res) => {
    logger.info('Meta Lead Event Received');
    // logger.debug('Meta Payload:', JSON.stringify(req.body, null, 2));

    try {
        const changes = req.body.entry?.[0]?.changes?.[0]?.value;
        if (!changes || !changes.leadgen_id) {
            logger.warn('Meta Webhook: Missing leadgen_id in payload');
            return res.status(200).send('EVENT_RECEIVED'); // Always respond with 200 to Meta
        }

        const leadId = changes.leadgen_id;
        const formId = changes.form_id;
        const pageId = changes.page_id;

        logger.info(`Received Meta Lead: ID=${leadId}, FormID=${formId}, PageID=${pageId}`);

        // TODO: Implement lead detail fetching using Meta Graph API
        // Requires: Page Access Token (META_ACCESS_TOKEN)
        /*
        const response = await axios.get(`https://graph.facebook.com/v12.0/${leadId}`, {
            params: { access_token: process.env.META_ACCESS_TOKEN }
        });
        const leadDetails = response.data;
        // Process and store leadDetails via leadService.createLeadInDB(...)
        */

        // For now, we only log as lead details are not yet available without a token
        res.status(200).send('EVENT_RECEIVED');
    } catch (error) {
        logger.error('Error processing Meta Webhook:', error.message);
        // Meta expects a 200 even if processing fails to avoid retries in some cases, 
        // but 500 can be used if you want them to retry. 
        // User code used 200 in catch.
        res.status(200).send('EVENT_RECEIVED');
    }
};

module.exports = {
    verifyWebhook,
    handleMetaLead
};
