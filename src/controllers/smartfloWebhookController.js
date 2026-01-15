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
        let direction = eventData.direction; // 'inbound', 'outbound', 'click_to_call'
        // Normalize 'click_to_call' to 'outbound' as per user request
        if (direction === 'click_to_call' || direction === 'dialer') {
            direction = 'outbound';
        }
        const duration = parseInt(eventData.duration || eventData.billsec || '0', 10);
        const recordingUrl = eventData.recording_url;
        const agentNumber = eventData.agent_number || eventData.answered_agent_number;
        const customerNumber = eventData.customer_number || eventData.call_to_number;

        // 2. Dynamic Relationship: If we have a Ref ID (Lead ID), update the Lead
        // 2. Dynamic Relationship: If we have a Ref ID (Lead ID), update the Lead
        if (refId) {
            // Extract basic Lead ID if composite (format: LeadID__UUID)
            const realLeadId = refId.includes('__') ? refId.split('__')[0] : refId;

            // Check if it's a UUID (Lead ID)
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(realLeadId);

            if (isUuid) {
                // Fetch current lead to append call log (Using parsed ID)
                const lead = await leadService.getLeadById(realLeadId);
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

                    await leadService.updateLeadInDB(realLeadId, updates);
                    logger.info(`Updated Lead ${realLeadId} from Webhook. Status: ${status}`);
                }
            }
        }

        // 3. Store Call Info in DynamoDB 'CRMCalls' -> REMOVED per user request
        // Legacy DynamoDB logic has been deprecated in favor of Firebase Realtime DB.

        // 4. Update Firebase Realtime Database
        const { db, admin } = require('../config/firebase');

        if (db && refId) {
            try {
                // User requested name change (or distinct path). Using 'smartflo_calls' as a clean root.
                const path = `smartflo_calls/${refId}`;
                const callRef = db.ref(path);

                console.log(`[Webhook] Writing to Firebase path: ${path} | Status: ${status}`);

                // Helper to remove undefined fields (Firebase rejects them)
                const removeUndefined = (obj) => {
                    return Object.fromEntries(
                        Object.entries(obj).filter(([_, v]) => v !== undefined)
                    );
                };

                // Create the data object (allowing undefined values initially)
                // Use spread ...eventData to capture ALL dynamic fields sent by Smartflo
                const rawData = {
                    ...eventData,
                    ref_id: refId,
                    call_id: callId,
                    status: status,
                    to: customerNumber,
                    from: agentNumber,
                    agent: agentNumber,
                    start_time: eventData.start_stamp || getISTTimestamp(),
                    direction: direction,
                    customer: customerNumber,
                    updated_at: admin.database.ServerValue.TIMESTAMP
                };

                // Sanitize it
                const sanitizedData = removeUndefined(rawData);
                console.log('[Webhook] Writing data:', JSON.stringify(sanitizedData));

                // Write data (Use update to merge fields from different webhook events)
                await callRef.update(sanitizedData);

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
