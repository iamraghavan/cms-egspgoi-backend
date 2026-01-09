const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { v4: uuidv4 } = require('uuid');
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');

const seedRoles = async () => {
  try {
    // Fetch all existing roles
    const scanCommand = new ScanCommand({ TableName: ROLES_TABLE });
    const existingRolesResult = await docClient.send(scanCommand);
    const existingRoles = existingRolesResult.Items || [];
    const existingRoleNames = new Set(existingRoles.map(r => r.name));

    const roles = [
      { name: 'Super Admin', permissions: { all: true } },
      { name: 'Marketing Manager', permissions: { campaigns: true, budgets: true } },
      { name: 'Finance', permissions: { budgets_approve: true, proofs_verify: true } },
      { name: 'Admission Manager', permissions: { leads_manage: true, pipelines: true, view_live_calls: true, manage_active_calls: true, view_call_records: true } },
      { name: 'Admission Executive', permissions: { leads_call: true, click_to_call: true, view_call_records: true, view_live_calls: true, manage_active_calls: true } },
      { name: 'Designer', permissions: { assets_upload: true } },
      { name: 'Editor', permissions: { assets_upload: true } }
    ];

    for (const role of roles) {
      if (existingRoleNames.has(role.name)) {
        console.log(`Role '${role.name}' already exists. Skipping.`);
        continue;
      }

      const command = new PutCommand({
        TableName: ROLES_TABLE,
        Item: {
          id: uuidv4(),
          name: role.name,
          permissions: role.permissions
        }
      });
      await docClient.send(command);
      console.log(`Role '${role.name}' created.`);
    }
    console.log("Roles seeded successfully.");
  } catch (error) {
    console.error("Failed to seed roles:", error);
  }
};

seedRoles();
