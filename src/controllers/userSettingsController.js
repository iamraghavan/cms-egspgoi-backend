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

        // Validate individual preference fields if needed, relying on Joi during save is better but direct update needs check or schema use
        // Ideally we should use userSchema.validate({ ...existingUser, preferences: ... }) but that requires a fetch.
        // For now, we trust the input structure matches strictly Joi expectations loosely:
        // Or specific validation:
        const validKeys = ['currency', 'language', 'timezone', 'date_format', 'theme'];
        const updateExpressionParts = [];
        const expressionAttributeValues = { ":now": getISTTimestamp() };
        const expressionAttributeNames = {};

        Object.keys(preferences).forEach((key, index) => {
            if (validKeys.includes(key)) {
                const attrName = `#pref_${key}`;
                const attrVal = `:val_${key}`;
                // We update inside the 'preferences' map. 
                // DynamoDB supports nested updates via dot notation if map exists.
                // However, if 'preferences' doesn't exist, we might need to initialize it.
                // Safe way: update the entire preferences object OR user SET preferences.currency = :val
                // Let's expect 'preferences' field exists (defaulted in model). 
                updateExpressionParts.push(`preferences.${key} = ${attrVal}`);
                expressionAttributeValues[attrVal] = preferences[key];
            }
        });

        if (updateExpressionParts.length === 0) {
            return res.status(400).json({ message: 'No valid settings provided' });
        }

        const updateExpression = "SET " + updateExpressionParts.join(', ') + ", updated_at = :now";

        const command = new UpdateCommand({
            TableName: USERS_TABLE,
            Key: { id },
            UpdateExpression: updateExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: "ALL_NEW"
        });

        const result = await docClient.send(command);
        
        const user = result.Attributes;
        delete user.password_hash;
        
        res.json({ message: 'Settings updated successfully', settings: user.preferences });

    } catch (error) {
        console.error('Update Settings Error:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

module.exports = { updateSettings };
