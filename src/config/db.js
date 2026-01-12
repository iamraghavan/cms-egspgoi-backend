const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const { NodeHttpHandler } = require("@aws-sdk/node-http-handler"); // Optimization: Connection Pooling
const config = require('./env');

const client = new DynamoDBClient({
  region: config.aws.region,
  credentials: {
    accessKeyId: config.aws.accessKeyId,
    secretAccessKey: config.aws.secretAccessKey,
  },
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5000, // 5s connection timeout
    requestTimeout: 5000, // 5s request timeout
    maxSockets: 50, // Optimize: Increase concurrent sockets (Default is 50 in Node v18+, but good to be explicit)
    httpAgent: { keepAlive: true },
    httpsAgent: { keepAlive: true }
  }),
  // endpoint: process.env.DYNAMODB_ENDPOINT // Uncomment for local DynamoDB
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true, // Remove undefined values from objects
  },
});

module.exports = { docClient, client };
