const kafka = require('../config/kafka');

const consumer = kafka.consumer({ groupId: 'cms-backend-automation-group' });

const runConsumer = async () => {
    try {
        await consumer.connect();
        console.log('Kafka Consumer Connected');

        // Subscribe to relevant topics
        await consumer.subscribe({ topic: 'LEAD_EVENTS', fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                const prefix = `${topic}[${partition}|${message.offset}] / ${message.timestamp}`;
                const payload = message.value.toString();

                try {
                    const data = JSON.parse(payload);
                    handleMessage(topic, data);
                } catch (e) {
                    console.error(`Error parsing message JSON: ${e.message}`);
                }
            },
        });
    } catch (error) {
        console.error('Kafka Consumer Error:', error.message);
    }
};

/**
 * Handle Business Logic for Events
 */
const handleMessage = async (topic, data) => {
    if (topic === 'LEAD_EVENTS') {
        if (data.type === 'LEAD_CREATED') {
            console.log(`[AUTOMATION] Received LEAD_CREATED for ${data.data.name}`);
            // Simulate Sending Email
            await simulateEmailTrigger(data.data);
        }
    }
};

const simulateEmailTrigger = async (lead) => {
    // Simulate delay
    setTimeout(() => {
        console.log(`[EMAIL SERVICE] Sending Welcome Email to ${lead.email} ... SENT!`);
    }, 2000);
};

// Start Consumer
runConsumer();

module.exports = { runConsumer };
