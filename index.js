const dotenv = require('dotenv');
console.log("Dotenv loaded");
dotenv.config();

console.log("Requiring server...");
const app = require('./server');
console.log("Server required");

console.log("Requiring db...");
const { client } = require('./src/config/db');
console.log("DB required");

// DuckDB Initialization
const { initDuckDB } = require('./src/config/duckdb');

const { ListTablesCommand } = require("@aws-sdk/client-dynamodb");

const PORT = process.env.PORT || 3000;

// Handle Uncaught Exceptions (Synchronous)
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message, err.stack);
  process.exit(1);
});

let server;

const startServer = async () => {
  try {
    // Test DB connection by listing tables
    console.log("Checking DynamoDB connection...");
    await client.send(new ListTablesCommand({}));
    console.log("Connected to DynamoDB");

    // Initialize DuckDB
    await initDuckDB();
    console.log("Connected to DuckDB (Analytics)");

    // Initialize SQLite Cache
    const { initCache } = require('./src/config/sqliteCache');
    initCache(); // Synchronous
    console.log("Initialized SQLite In-Memory Cache");

    server = app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Handle Unhandled Rejections (Asynchronous)
process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED REJECTION! 💥 Shutting down...');
  console.error(err.name, err.message);
  if (server) {
    server.close(() => {
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
});

// Graceful Shutdown (SIGTERM / SIGINT)
const gracefulShutdown = () => {
  console.log('SIGTERM/SIGINT received. Shutting down gracefully...');
  if (server) {
    server.close(() => {
      console.log('Process terminated.');
      // Close DB connections if necessary (AWS SDK v3 uses HTTP, usually fine, but if pooling, can destroy)
      // client.destroy(); 
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
