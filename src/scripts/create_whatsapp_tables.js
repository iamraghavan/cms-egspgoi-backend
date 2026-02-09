const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/db");
const { WHATSAPP_HISTORY_TABLE } = require("../models/whatsappModel");

const createTable = async (tableName, partitionKey, sortKey = null, globalIndexes = []) => {
    try {
        const params = {
            TableName: tableName,
            KeySchema: [
                { AttributeName: partitionKey.name, KeyType: "HASH" }
            ],
            AttributeDefinitions: [
                { AttributeName: partitionKey.name, AttributeType: partitionKey.type }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            }
        };

        if (sortKey) {
            params.KeySchema.push({ AttributeName: sortKey.name, KeyType: "RANGE" });
            params.AttributeDefinitions.push({ AttributeName: sortKey.name, AttributeType: sortKey.type });
        }

        if (globalIndexes.length > 0) {
            params.GlobalSecondaryIndexes = globalIndexes.map(idx => {
                if (!params.AttributeDefinitions.find(d => d.AttributeName === idx.partitionKey.name)) {
                    params.AttributeDefinitions.push({ AttributeName: idx.partitionKey.name, AttributeType: idx.partitionKey.type });
                }
                if (idx.sortKey && !params.AttributeDefinitions.find(d => d.AttributeName === idx.sortKey.name)) {
                    params.AttributeDefinitions.push({ AttributeName: idx.sortKey.name, AttributeType: idx.sortKey.type });
                }

                const gsiConfig = {
                    IndexName: idx.name,
                    KeySchema: [
                        { AttributeName: idx.partitionKey.name, KeyType: "HASH" }
                    ],
                    Projection: {
                        ProjectionType: "ALL"
                    },
                    ProvisionedThroughput: {
                        ReadCapacityUnits: 5,
                        WriteCapacityUnits: 5
                    }
                };

                if (idx.sortKey) {
                    gsiConfig.KeySchema.push({ AttributeName: idx.sortKey.name, KeyType: "RANGE" });
                }
                return gsiConfig;
            });
        }

        const command = new CreateTableCommand(params);
        await client.send(command);
        console.log(`Created table: ${tableName}`);
    } catch (error) {
        if (error.name === 'ResourceInUseException') {
            console.log(`Table ${tableName} already exists.`);
        } else {
            console.error(`Error creating table ${tableName}:`, error);
        }
    }
};

const createWhatsAppTables = async () => {
    console.log("Starting WhatsApp Database Migration...");

    // PK: id (S)
    // GSI: LeadIndex -> lead_id (S) + created_at (S)
    await createTable(WHATSAPP_HISTORY_TABLE, { name: "id", type: "S" }, null, [
        {
            name: "LeadIndex",
            partitionKey: { name: "lead_id", type: "S" },
            sortKey: { name: "created_at", type: "S" }
        }
    ]);

    console.log("WhatsApp Database Migration Completed.");
};

createWhatsAppTables().catch(console.error);
