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
        logger.info('Smartflo Webhook Received:', JSON.stringify(eventData, null, 2));

        // Basic event processing
        // We are primarily interested in matching calls to Leads.
        // Smartflo webhooks usually send `$call_to_number` or `$customer_number`
        // Note: The params sent by Smartflo might be in the body directly.

        // Extract key info based on common patterns in docs
        const customerNumber = eventData.customer_number || eventData.call_to_number || eventData.destination_number;
        const agentNumber = eventData.agent_number || eventData.answered_agent_number;
        const status = eventData.call_status || 'unknown';
        const direction = eventData.direction; // 'inbound' or 'outbound' or 'click_to_call'
        const duration = eventData.duration || eventData.billsec;

        if (!customerNumber) {
            logger.warn('Webhook received without customer number');
            return res.status(200).send('OK'); // Ack to prevent retries
        }

        // Normalize customer number for lookup (e.g. remove +91 prefix matching)
        // This is tricky because lead phone is E.164. 
        // We'll search using a precise match if possible, or Scan.

        // TODO: Implement logic to update Lead "Last Call Status" or add a "Call Log" note.
        // For now, we just acknowledge receipt as this is a new feature.

        // Broadcast Call Status (e.g. for Live Monitor)
        const { broadcast } = require('../services/socketService');
        broadcast('call_status', {
            agent: agentNumber,
            customer: customerNumber,
            status: status,
            direction: direction,
            duration: duration,
            timestamp: getISTTimestamp()
        });

        res.status(200).send('Webhook Received');
    } catch (error) {
        logger.error('Webhook Error:', error);
        res.status(500).send('Error');
    }
};

module.exports = { handleWebhook };
