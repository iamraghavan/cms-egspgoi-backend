const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/db"); // Using the raw client from config
const {
    CMS_SITES_TABLE,
    CMS_CATEGORIES_TABLE,
    CMS_PAGES_TABLE,
    CMS_POSTS_TABLE,
    CMS_ADS_TABLE
} = require("../models/cmsModel");

const createTable = async (tableName, partitionKey, sortKey = null, globalIndexes = []) => {
    try {
        const params = {
            TableName: tableName,
            KeySchema: [
                { AttributeName: partitionKey.name, KeyType: "HASH" } // Partition Key
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
                // Ensure required attributes for GSI exist in Definitions
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

const createCMSTables = async () => {
    console.log("Starting CMS Database Migration...");

    // 1. CMS_Sites
    // PK: id (S)
    await createTable(CMS_SITES_TABLE, { name: "id", type: "S" });

    // 2. CMS_Categories
    // PK: id (S)
    // GSI: SiteIndex -> site_id (S)
    await createTable(CMS_CATEGORIES_TABLE, { name: "id", type: "S" }, null, [
        { name: "SiteIndex", partitionKey: { name: "site_id", type: "S" } }
    ]);

    // 3. CMS_Pages
    // PK: id (S)
    // GSI: SiteIndex -> site_id (S) + slug (S)
    await createTable(CMS_PAGES_TABLE, { name: "id", type: "S" }, null, [
        {
            name: "SiteIndex",
            partitionKey: { name: "site_id", type: "S" },
            sortKey: { name: "slug", type: "S" }
        }
    ]);

    // 4. CMS_Posts
    // PK: id (S)
    // GSI: SiteIndex -> site_id (S) + published_at (S) (For listing by recency)
    await createTable(CMS_POSTS_TABLE, { name: "id", type: "S" }, null, [
        {
            name: "SiteIndex",
            partitionKey: { name: "site_id", type: "S" },
            sortKey: { name: "published_at", type: "S" }
        }
    ]);

    // 5. CMS_Ads
    // PK: id (S)
    // GSI: SiteIndex -> site_id (S)
    await createTable(CMS_ADS_TABLE, { name: "id", type: "S" }, null, [
        { name: "SiteIndex", partitionKey: { name: "site_id", type: "S" } }
    ]);

    console.log("CMS Database Migration Completed.");
};

createCMSTables().catch(console.error);
