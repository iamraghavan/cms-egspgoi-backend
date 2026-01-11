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

/**
 * Finds a user by name (Case Insensitive Partial Match).
 * Using Scan as Users table is small.
 * @param {string} name 
 * @returns {object|null} User object or null
 */
const findUserByName = async (name) => {
    if (!name) return null;

    try {
        const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
        const lowerName = name.toLowerCase();

        // Scan all users (Efficient enough for < 1000 users)
        const command = new ScanCommand({
            TableName: USERS_TABLE,
            ProjectionExpression: 'id, #name',
            ExpressionAttributeNames: { '#name': 'name' }
        });

        const result = await docClient.send(command);
        const users = result.Items || [];

        // Find match in memory
        const match = users.find(u => u.name && u.name.toLowerCase() === lowerName);

        // If no exact match, try includes? User requested "assigned_to_name", usually implies selection from dropdown.
        // Let's stick to strict-ish equality (case-insensitive) to avoid ambiguity.
        return match || null;
    } catch (error) {
        console.error("Error finding user by name:", error);
        return null;
    }
};

/**
 * Finds all users with a specific Role ID.
 * @param {string} roleId 
 * @returns {Array<object>} List of users
 */
const findUsersByRole = async (roleId) => {
    if (!roleId) return [];

    try {
        const { ScanCommand } = require("@aws-sdk/lib-dynamodb");

        // Scan all users (Efficient enough for < 1000 users) -> Ideally GSI on role_id
        const command = new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: 'role_id = :roleId',
            ExpressionAttributeValues: { ':roleId': roleId },
            ProjectionExpression: 'id, #name, role_id',
            ExpressionAttributeNames: { '#name': 'name' }
        });

        const result = await docClient.send(command);
        return result.Items || [];
    } catch (error) {
        console.error("Error finding users by role:", error);
        return [];
    }
};

module.exports = { getUserNamesMap, getUsersDetailsMap, findUserByName, findUsersByRole };
