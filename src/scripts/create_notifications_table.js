const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/db");

const createTable = async () => {
    const params = {
        TableName: "Notifications",
        KeySchema: [
            { AttributeName: "user_id", KeyType: "HASH" },  // Partition Key
            { AttributeName: "timestamp", KeyType: "RANGE" } // Sort Key
        ],
        AttributeDefinitions: [
            { AttributeName: "user_id", AttributeType: "S" },
            { AttributeName: "timestamp", AttributeType: "S" }
        ],
        ProvisionedThroughput: {
            ReadCapacityUnits: 5,
            WriteCapacityUnits: 5
        }
    };

    try {
        const command = new CreateTableCommand(params);
        const data = await client.send(command);
        console.log("Created table. Table description JSON:", JSON.stringify(data, null, 2));
    } catch (err) {
        if (err.name === 'ResourceInUseException') {
            console.log("Table 'Notifications' already exists.");
        } else {
            console.error("Unable to create table. Error JSON:", JSON.stringify(err, null, 2));
        }
    }
};

createTable();
