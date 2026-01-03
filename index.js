const dotenv = require('dotenv');
console.log("Dotenv loaded");
dotenv.config();

console.log("Requiring server...");
const app = require('./server');
console.log("Server required");

console.log("Requiring db...");
const { client } = require('./src/config/db');
console.log("DB required");

const { ListTablesCommand } = require("@aws-sdk/client-dynamodb");

const PORT = process.env.PORT || 3000;

const http = require('http');
const { initSocket } = require('./src/services/socketService');

// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

// Initialize Kafka Consumer (for background tasks)
require('./src/services/mqConsumer');

const startServer = async () => {
  try {
    // Test DB connection by listing tables
    console.log("Checking DynamoDB connection...");
    await client.send(new ListTablesCommand({}));
    console.log("Connected to DynamoDB");

    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
