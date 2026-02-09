const { sendWhatsAppMessage } = require('../services/whatsappService');
const { docClient } = require('../config/db');
const { GetCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');

const sendCallNotReachableMessage = async (req, res) => {
    try {
        const { id } = req.params; // Lead ID
        const userId = req.user.id; // From Auth Middleware

        // 1. Fetch Lead
        const leadCmd = new GetCommand({
            TableName: LEADS_TABLE,
            Key: { id }
        });
        const leadResult = await docClient.send(leadCmd);
        const lead = leadResult.Item;

        if (!lead) {
            return res.status(404).json({ message: "Lead not found" });
        }

        // 2. Prepare Template Variables
        // Template: call_not_reachable
        // Hello {{lead_name}},
        // We attempted to contact you regarding your enquiry for {{course_name}}...
        const variables = {
            text1: lead.name,
            text2: lead.course || lead.form_data?.course || "our courses"
        };

        // 3. Send Message
        const result = await sendWhatsAppMessage({
            leadId: lead.id,
            phone: lead.phone.replace('+', ''), // API expects phone without +
            templateName: 'call_not_reachable',
            variables,
            sentBy: userId
        });

        if (result.success) {
            res.json({ message: "WhatsApp message sent successfully", historyId: result.historyId, details: result.data });
        } else {
            res.status(500).json({ message: "Failed to send WhatsApp message", error: result.error });
        }

    } catch (error) {
        console.error('WhatsApp Controller Error:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    sendCallNotReachableMessage
};
