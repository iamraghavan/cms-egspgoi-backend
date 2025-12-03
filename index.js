require('dotenv').config();
const app = require('./server');
const { client } = require('./src/config/db');
const { ListTablesCommand } = require("@aws-sdk/client-dynamodb");

const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // Test DB connection by listing tables
    console.log("Checking DynamoDB connection...");
    await client.send(new ListTablesCommand({}));
    console.log("Connected to DynamoDB");
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
