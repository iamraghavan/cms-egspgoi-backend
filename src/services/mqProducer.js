const kafka = require('../config/kafka');

const producer = kafka.producer();

let isConnected = false;

const connectProducer = async () => {
    try {
        await producer.connect();
        isConnected = true;
        console.log('Kafka Producer Connected');
    } catch (error) {
        console.error('Kafka Producer Connection Failed:', error.message);
        // Retry logic could go here, but avoiding crash is priority
    }
};

const publishEvent = async (topic, message, key = null) => {
    if (!isConnected) {
        // Attempt reconnect or just log error (fail-soft)
        console.warn('Kafka Producer not connected. Skipping message:', topic);
        return;
    }

    try {
        await producer.send({
            topic,
            messages: [
                {
                    key: key ? key.toString() : undefined,
                    value: JSON.stringify(message)
                }
            ]
        });
        // console.log(`Message sent to topic ${topic}`);
    } catch (error) {
        console.error(`Failed to send message to ${topic}:`, error.message);
    }
};

const disconnectProducer = async () => {
    if (isConnected) {
        await producer.disconnect();
        isConnected = false;
    }
};

// Initial connection attempt
connectProducer();

module.exports = { publishEvent, connectProducer, disconnectProducer };
