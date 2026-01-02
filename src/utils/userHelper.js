const { BatchGetCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require('../config/db');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');

/**
 * Fetches user details for a list of IDs.
 * @param {Array<string>} userIds - List of user UUIDs.
 * @returns {Object} - Map of userId -> userName
 */
const getUserNamesMap = async (userIds) => {
    if (!userIds || userIds.length === 0) return {};

    const uniqueIds = [...new Set(userIds)].filter(id => id); // Dedup and remove nulls
    if (uniqueIds.length === 0) return {};

    // DynamoDB BatchGetItem has a limit of 100 items. 
    // If we have more (unlikely for a page of 20 leads), we should chunk it. 
    // For now, assuming < 100 unique agents per page.

    const keys = uniqueIds.map(id => ({ id }));

    // Construct keys for BatchGet
    const command = new BatchGetCommand({
        RequestItems: {
            [USERS_TABLE]: {
                Keys: keys,
                ProjectionExpression: 'id, #name',
                ExpressionAttributeNames: { '#name': 'name' }
            }
        }
    });

    try {
        const result = await docClient.send(command);
        const users = result.Responses[USERS_TABLE] || [];

        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = user.name;
        });
        return userMap;
    } catch (error) {
        console.error("Error fetching user names:", error);
        return {}; // Return empty map on error to avoid breaking main flow
    }
};

/**
 * Fetches full user details for a list of IDs.
 * @param {Array<string>} userIds - List of user UUIDs.
 * @returns {Object} - Map of userId -> userObject
 */
const getUsersDetailsMap = async (userIds) => {
    if (!userIds || userIds.length === 0) return {};

    const uniqueIds = [...new Set(userIds)].filter(id => id);
    if (uniqueIds.length === 0) return {};

    const keys = uniqueIds.map(id => ({ id }));

    // Fetch more fields: id, name, email, phone, role_id, status, is_available
    const command = new BatchGetCommand({
        RequestItems: {
            [USERS_TABLE]: {
                Keys: keys,
                ProjectionExpression: 'id, #name, email, phone, role_id, #status, is_available',
                ExpressionAttributeNames: { '#name': 'name', '#status': 'status' }
            }
        }
    });

    try {
        const result = await docClient.send(command);
        const users = result.Responses[USERS_TABLE] || [];

        const userMap = {};
        users.forEach(user => {
            userMap[user.id] = user;
        });
        return userMap;
    } catch (error) {
        console.error("Error fetching user details:", error);
        return {};
    }
};

module.exports = { getUserNamesMap, getUsersDetailsMap };
