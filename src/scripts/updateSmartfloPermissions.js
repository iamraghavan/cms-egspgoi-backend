const { ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require("../config/db");
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');
const logger = require('../utils/logger');

const updatePermissions = async () => {
    try {
        console.log('Fetching roles to update...');
        // 1. Fetch all roles/scan for Admission Exec
        const scanCommand = new ScanCommand({ TableName: ROLES_TABLE });
        const result = await docClient.send(scanCommand);
        const roles = result.Items || [];

        const targetRoles = ['Admission Executive', 'Admission Manager'];

        for (const role of roles) {
            if (targetRoles.includes(role.name)) {
                console.log(`Updating permissions for role: ${role.name}`);

                // Define new permissions to merge/ensure
                const additionalPermissions = {
                    view_live_calls: true,
                    manage_active_calls: true,
                    view_call_records: true, // ensure this is set
                    click_to_call: true      // ensure this is set
                };

                // Merge existing permissions with new ones
                const updatedPermissions = { ...role.permissions, ...additionalPermissions };

                const updateCommand = new UpdateCommand({
                    TableName: ROLES_TABLE,
                    Key: { id: role.id },
                    UpdateExpression: 'set permissions = :p',
                    ExpressionAttributeValues: {
                        ':p': updatedPermissions
                    },
                    ReturnValues: 'UPDATED_NEW'
                });

                await docClient.send(updateCommand);
                console.log(`Successfully updated permissions for ${role.name}`);
            }
        }
        console.log('Permission update complete.');
    } catch (error) {
        console.error('Error updating permissions:', error);
    }
};

updatePermissions();
