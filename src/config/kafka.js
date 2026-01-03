const { Kafka, logLevel } = require('kafkajs');

const clientId = process.env.KAFKA_CLIENT_ID || 'cms-backend';
const brokers = (process.env.KAFKA_BROKER || 'localhost:9092').split(',');

const kafkaConfig = {
    clientId,
    brokers,
    logLevel: logLevel.ERROR
};

// Authentication Configuration
const username = process.env.KAFKA_USERNAME;
const password = process.env.KAFKA_PASSWORD;
const mechanism = process.env.KAFKA_MECHANISM || 'plain'; // plain, scram-sha-256, scram-sha-512, aws-msk-iam

if (username && password) {
    kafkaConfig.ssl = process.env.KAFKA_SSL === 'true'; // Often required for Cloud Kafka (Upstash/Confluent)
    kafkaConfig.sasl = {
        mechanism: mechanism,
        username,
        password
    };
    console.log(`Kafka Auth Enabled: ${mechanism}`);
}

const kafka = new Kafka(kafkaConfig);

module.exports = kafka;
