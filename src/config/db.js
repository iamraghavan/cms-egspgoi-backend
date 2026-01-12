const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler"); // Optimization: Connection Pooling
const config = require('./env');

const https = require('https'); // Required for Agent

const client = new DynamoDBClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5000,
    requestTimeout: 5000,
    httpsAgent: new https.Agent({
      keepAlive: true,
      maxSockets: 50 // Optimization
    })
  }),
  // endpoint: process.env.DYNAMODB_ENDPOINT // Uncomment for local DynamoDB
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // Remove undefined values from objects
  },
});

module.exports = { docClient, client };
