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
        const { docClient, client } = require('../config/db');
        const { PutCommand } = require('@aws-sdk/lib-dynamodb');
        const { CreateTableCommand, waitUntilTableExists } = require('@aws-sdk/client-dynamodb');

        // Schema constraint: ref_id is PK, call_id is SK.
        // If ref_id is missing (rare but possible), we fallback to 'unknown' or uuid to prevent Primary Key errors.
        const partitionKey = refId || `unknown-${callId}`;

        const callRecord = {
            ref_id: partitionKey,      // Partition Key
            call_id: callId,           // Sort Key
            ...eventData,
            created_at: getISTTimestamp()
        };

        const putCommand = new PutCommand({
            TableName: 'CRMCalls',
            Item: callRecord
        });

        try {
            await docClient.send(putCommand);
        } catch (dbError) {
            if (dbError.name === 'ResourceNotFoundException') {
                logger.warn('CRMCalls table not found. Attempting to create...');
                const createCommand = new CreateTableCommand({
                    TableName: 'CRMCalls',
                    KeySchema: [
                        { AttributeName: 'ref_id', KeyType: 'HASH' },
                        { AttributeName: 'call_id', KeyType: 'RANGE' }
                    ],
                    AttributeDefinitions: [
                        { AttributeName: 'ref_id', AttributeType: 'S' },
                        { AttributeName: 'call_id', AttributeType: 'S' }
                    ],
                    BillingMode: 'PAY_PER_REQUEST'
                });

                try {
                    await client.send(createCommand);
                    logger.info('Creating CRMCalls table... Waiting for active state.');

                    // Wait up to 20 seconds for table to be active
                    await waitUntilTableExists({ client, maxWaitTime: 20 }, { TableName: 'CRMCalls' });

                    logger.info('CRMCalls table created. Retrying write...');
                    await docClient.send(putCommand);
                } catch (createError) {
                    logger.error('Failed to auto-create table:', createError);
                    if (createError.name === 'ResourceInUseException') {
                        throw new Error('Table creation in progress via another request.');
                    }
                    throw createError;
                }
            } else {
                throw dbError;
            }
        }

        // 4. Update Firebase Realtime Database
        const { db, admin } = require('../config/firebase');

        if (db && refId) {
            try {
                // User requested name change (or distinct path). Using 'smartflo_calls' as a clean root.
                const path = `smartflo_calls/${refId}`;
                const callRef = db.ref(path);

                console.log(`[Webhook] Writing to Firebase path: ${path} | Status: ${status}`);

                // Write data
                await callRef.set({
                    ref_id: refId,
                    call_id: callId,
                    status: status,
                    to: customerNumber,
                    from: agentNumber, // or callerId
                    agent: agentNumber,
                    start_time: eventData.start_stamp || getISTTimestamp(),
                    direction: direction,
                    customer: customerNumber,
                    updated_at: admin.database.ServerValue.TIMESTAMP
                });

                console.log('[Webhook] Firebase write successful.');
            } catch (firebaseError) {
                console.error('[Webhook] Firebase Update Error:', firebaseError);
                // Don't block response on firebase error
            }
        } else {
            if (!db) console.error('[Webhook] Firebase DB object is NULL. Check config.');
            if (!refId) console.warn('[Webhook] ref_id missing, cannot write to Firebase.');
        }

        res.status(200).send('OK');
    } catch (error) {
        logger.error('Webhook Error:', error);
        res.status(500).send('Error');
    }
};

module.exports = { handleWebhook };
