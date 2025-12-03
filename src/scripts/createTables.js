const { CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { client } = require("../config/db");
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');
const { BUDGET_TABLE_NAME, PROOF_TABLE_NAME } = require('../models/budgetModel');
const { TABLE_NAME: ASSETS_TABLE } = require('../models/assetModel');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: INTEGRATIONS_TABLE } = require('../models/integrationModel');
const { TABLE_NAME: PAYMENT_TABLE } = require('../models/paymentRecordModel');
const { TABLE_NAME: AD_SPEND_TABLE } = require('../models/adSpendModel');

const createTable = async (tableName, keySchema, attributeDefinitions, globalSecondaryIndexes = []) => {
  const params = {
    TableName: tableName,
    KeySchema: keySchema,
    AttributeDefinitions: attributeDefinitions,
    BillingMode: "PAY_PER_REQUEST",
  };

  if (globalSecondaryIndexes.length > 0) {
    params.GlobalSecondaryIndexes = globalSecondaryIndexes;
  }

  try {
    const command = new CreateTableCommand(params);
    await client.send(command);
    console.log(`Table ${tableName} created successfully.`);
  } catch (error) {
    if (error.name === "ResourceInUseException") {
      console.log(`Table ${tableName} already exists.`);
    } else {
      console.error(`Error creating table ${tableName}:`, error);
    }
  }
};

const initTables = async () => {
  // Users Table
  await createTable(
    USERS_TABLE,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "email", AttributeType: "S" }
    ],
    [{
      IndexName: "EmailIndex",
      KeySchema: [{ AttributeName: "email", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" }
    }]
  );

  // Roles Table
  await createTable(
    ROLES_TABLE,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [{ AttributeName: "id", AttributeType: "S" }]
  );

  // Campaigns Table
  await createTable(
    CAMPAIGNS_TABLE,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [{ AttributeName: "id", AttributeType: "S" }]
  );

  // Budgets Table
  await createTable(
    BUDGET_TABLE_NAME,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [{ AttributeName: "id", AttributeType: "S" }]
  );

  // BudgetProofs Table
  await createTable(
    PROOF_TABLE_NAME,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [{ AttributeName: "id", AttributeType: "S" }]
  );

  // Assets Table
  await createTable(
    ASSETS_TABLE,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [{ AttributeName: "id", AttributeType: "S" }]
  );

  // Leads Table
  await createTable(
    LEADS_TABLE,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "phone", AttributeType: "S" }
    ],
    [{
      IndexName: "PhoneIndex",
      KeySchema: [{ AttributeName: "phone", KeyType: "HASH" }],
      Projection: { ProjectionType: "ALL" }
    }]
  );

  // Integrations Table
  await createTable(
    INTEGRATIONS_TABLE,
    [{ AttributeName: "service_name", KeyType: "HASH" }],
    [{ AttributeName: "service_name", AttributeType: "S" }]
  );

  // Payment Records Table
  await createTable(
    PAYMENT_TABLE,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [{ AttributeName: "id", AttributeType: "S" }]
  );

  // Ad Spends Table
  await createTable(
    AD_SPEND_TABLE,
    [{ AttributeName: "id", KeyType: "HASH" }],
    [{ AttributeName: "id", AttributeType: "S" }]
  );

  console.log("All tables initialization process completed.");
};

initTables();
