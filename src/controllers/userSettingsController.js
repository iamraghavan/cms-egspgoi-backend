const { docClient } = require('../config/db');
const { UpdateCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { getISTTimestamp } = require('../utils/timeUtils');

const updateSettings = async (req, res) => {
    try {
        const { id } = req.user;
        const { preferences } = req.body;

        if (!preferences || typeof preferences !== 'object') {
            return res.status(400).json({ message: 'Preferences object is required' });
        }

        // 1. Fetch current user to get existing preferences
        const getCommand = new GetCommand({
            TableName: USERS_TABLE,
            Key: { id }
        });
        
        const userResult = await docClient.send(getCommand);
        if (!userResult.Item) {
            return res.status(404).json({ message: 'User not found' });
        }

        const currentUser = userResult.Item;
        const currentPreferences = currentUser.preferences || {};

        // 2. Merge new preferences with existing ones
        // Validate allowed keys
        const validKeys = ['currency', 'language', 'timezone', 'date_format', 'theme'];
        const newPreferences = { ...currentPreferences };

        let hasUpdates = false;
        Object.keys(preferences).forEach(key => {
            if (validKeys.includes(key)) {
                newPreferences[key] = preferences[key];
                hasUpdates = true;
            }
        });

        if (!hasUpdates) {
             return res.json({ message: 'No valid settings to update', settings: currentPreferences });
        }

        // 3. Update the ENTIRE preferences object
        // This avoids "DocumentPathNotDefinedException" for nested updates
        const updateCommand = new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { id },
            UpdateExpression: "SET preferences = :pref, updated_at = :now",
            ExpressionAttributeValues: {
                ":pref": newPreferences,
                ":now": getISTTimestamp()
            },
            ReturnValues: "ALL_NEW"
        });

        const result = await docClient.send(updateCommand);
        
        const updatedUser = result.Attributes;
        delete updatedUser.password_hash;
        
        res.json({ message: 'Settings updated successfully', settings: updatedUser.preferences });

    } catch (error) {
        console.error('Update Settings Error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { updateSettings };
