const leadService = require('../services/leadService');
const logger = require('../utils/logger');
const { getISTTimestamp } = require('../utils/timeUtils');

/**
 * Handle Incoming Smartflo Webhook
 * Supports various triggers like 'Call answered by Customer', 'Call missed', etc.
 */
const handleWebhook = async (req, res) => {
    try {
        const eventData = req.body;
        // logger.info('Smartflo Webhook Received:', JSON.stringify(eventData, null, 2));

        // 1. Extract Key Data
        // Smartflo sends slightly different keys based on trigger, but ref_id is consistent if we sent it.
        const refId = eventData.ref_id || eventData.custom_field;
        const callId = eventData.call_id || eventData.uuid;
        const status = eventData.call_status || 'unknown';
        const direction = eventData.direction; // 'inbound', 'outbound', 'click_to_call'
        const duration = parseInt(eventData.duration || eventData.billsec || '0', 10);
        const recordingUrl = eventData.recording_url;
        const agentNumber = eventData.agent_number || eventData.answered_agent_number;
        const customerNumber = eventData.customer_number || eventData.call_to_number;

        // 2. Dynamic Relationship: If we have a Ref ID (Lead ID), update the Lead
        if (refId) {
            // Check if it's a UUID (Lead ID)
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(refId);

            if (isUuid) {
                // Fetch current lead to append call log
                const lead = await leadService.getLeadById(refId);
                if (lead) {
                    const newCallLog = {
                        call_id: callId,
                        type: direction,
                        status: status,
                        duration: duration,
                        agent_number: agentNumber,
                        recording_url: recordingUrl,
                        timestamp: getISTTimestamp(),
                        raw_data: eventData // Optional: store full data for debug
                    };

                    // Append to call_history array (assuming schema supports it, if not we add note)
                    // If schema doesn't have call_history, we can add a Note or just update last_contacted
                    let updates = {};

                    // Add Note automatically if call connected > 30s
                    if (status.toLowerCase().includes('answered') && duration > 0) {
                        const noteContent = `Auto-Log: Call ${direction} connected for ${duration}s. Status: ${status}.`;
                        const newNote = {
                            note_id: require('uuid').v4(),
                            content: noteContent,
                            author_id: 'system',
                            author_name: 'Smartflo System',
                            author_role: 'System',
                            created_at: getISTTimestamp()
                        };
                        updates.notes = [...(lead.notes || []), newNote];
                    }

                    // Update last contacted
                    updates.last_contacted_at = getISTTimestamp();

                    await leadService.updateLeadInDB(refId, updates);
                    logger.info(`Updated Lead ${refId} from Webhook. Status: ${status}`);
                }
            }
        }

        // 3. Store Call Info in DynamoDB 'CRMCalls'
        const { docClient } = require('../config/db');
        const { PutCommand } = require('@aws-sdk/lib-dynamodb');

        const callRecord = {
            id: callId || require('uuid').v4(), // Partition Key
            ...eventData,
            created_at: getISTTimestamp()
        };

        const putCommand = new PutCommand({
            TableName: 'CRMCalls',
            Item: callRecord
        });

        await docClient.send(putCommand);

        // 4. Push Update to AppSync Subscription
        // We trigger a mutation 'publishCallUpdate' (or similar) which subscription listens to.
        const axios = require('axios');
        const config = require('../config/env');
        const appSyncUrl = config.appSync?.endpoint;
        const apiKey = config.appSync?.apiKey;

        if (appSyncUrl && apiKey) {
            const mutation = `
                mutation PublishCallUpdate($data: String!) {
                    publishCallUpdate(data: $data) {
                        data
                    }
                }
            `;

            // Sending raw JSON string as 'data' payload to match generic subscription pattern
            const variables = {
                data: JSON.stringify(callRecord)
            };

            await axios.post(
                appSyncUrl,
                { query: mutation, variables: variables },
                { headers: { 'x-api-key': apiKey } }
            );
            // logger.info('Pushed to AWS AppSync');
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook Error:', error);
        res.status(500).send('Error');
    }
};

module.exports = { handleWebhook };
