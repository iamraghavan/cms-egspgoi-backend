const { CreateTableCommand, DeleteTableCommand, waitUntilTableExists } = require('@aws-sdk/client-dynamodb');
const { client } = require('../config/db');

const recreateTable = async () => {
    const tableName = 'CRMCalls';

    // 1. Delete if exists (to apply new schema)
    try {
        console.log(`Checking if table "${tableName}" exists...`);
        // We attempt to delete. If it doesn't exist, it throws.
        await client.send(new DeleteTableCommand({ TableName: tableName }));
        console.log(`🗑️  Table "${tableName}" deleted. Waiting for deletion...`);
        // Wait for deletion? Usually fast. Await a bit.
        await new Promise(r => setTimeout(r, 5000));
    } catch (error) {
        if (error.name !== 'ResourceNotFoundException') {
            console.error('Error deleting table:', error);
        } else {
            console.log(`Table "${tableName}" does not exist (Clean slate).`);
        }
    }

    // 2. Create with new Schema
    const params = {
        TableName: tableName,
        KeySchema: [
            { AttributeName: 'ref_id', KeyType: 'HASH' },  // Partition Key (Lead ID)
            { AttributeName: 'call_id', KeyType: 'RANGE' } // Sort Key (Call ID) - unique per call
        ],
        AttributeDefinitions: [
            { AttributeName: 'ref_id', AttributeType: 'S' },
            { AttributeName: 'call_id', AttributeType: 'S' }
        ],
        BillingMode: 'PAY_PER_REQUEST'
    };

    try {
        console.log(`🔨 Creating table "${tableName}"...`);
        const command = new CreateTableCommand(params);
        await client.send(command);

        console.log('Waiting for table to be ACTIVE...');
        await waitUntilTableExists({ client, maxWaitTime: 60 }, { TableName: tableName });
        console.log(`✅ Success: Table "${tableName}" is now ACTIVE.`);

    } catch (error) {
        console.error('❌ Error creating table:', error);
    }
};

recreateTable();
