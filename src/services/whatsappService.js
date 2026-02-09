const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand } = require("@aws-sdk/lib-dynamodb");
const { WHATSAPP_HISTORY_TABLE } = require('../models/whatsappModel');
const { getISTTimestamp } = require('../utils/timeUtils');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL;

/**
 * Send a WhatsApp message using tryowbot API and log to history.
 * @param {Object} params - Message parameters
 * @param {string} params.leadId - Lead ID
 * @param {string} params.phone - Receiver's phone number
 * @param {string} params.templateName - WhatsApp template name
 * @param {Object} params.variables - Object containing text1, text2, etc.
 * @param {string} params.sentBy - User ID who sent the message
 */
const sendWhatsAppMessage = async ({ leadId, phone, templateName, variables, sentBy }) => {
    try {
        const payload = {
            token: WHATSAPP_TOKEN,
            phone: phone,
            template_name: templateName,
            template_language: "en_US",
            ...variables
        };

        const response = await axios.post(WHATSAPP_API_URL, payload, {
            headers: { 'Content-Type': 'application/json' }
        });

        const historyId = uuidv4();
        const historyItem = {
            id: historyId,
            lead_id: leadId,
            phone: phone,
            template_name: templateName,
            variables: variables,
            status: response.data.status === 'success' ? 'success' : 'failed',
            message_id: response.data.message_id || null,
            message_wamid: response.data.message_wamid || null,
            error: response.data.status !== 'success' ? response.data.message : null,
            created_at: getISTTimestamp(),
            sent_by: sentBy
        };

        await docClient.send(new PutCommand({
            TableName: WHATSAPP_HISTORY_TABLE,
            Item: historyItem
        }));

        return { success: true, historyId, data: response.data };

    } catch (error) {
        console.error('WhatsApp Service Error:', error.response?.data || error.message);

        // Log failure to history even if API call fails
        const historyId = uuidv4();
        await docClient.send(new PutCommand({
            TableName: WHATSAPP_HISTORY_TABLE,
            Item: {
                id: historyId,
                lead_id: leadId,
                phone: phone,
                template_name: templateName,
                variables: variables,
                status: 'failed',
                error: error.response?.data?.message || error.message,
                created_at: getISTTimestamp(),
                sent_by: sentBy
            }
        }));

        return { success: false, error: error.response?.data || error.message };
    }
};

module.exports = { sendWhatsAppMessage };
