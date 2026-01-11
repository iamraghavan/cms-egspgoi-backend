const { docClient } = require('../config/db');
const { PutCommand, GetCommand, ScanCommand, UpdateCommand, DeleteCommand, QueryCommand, TransactWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { getISTTimestamp } = require('../utils/timeUtils');

const { TABLE_NAME } = require('../models/leadModel');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');

class LeadRepository {
    async create(lead) {
        const command = new PutCommand({
            TableName: TABLE_NAME,
            Item: lead
        });
        await docClient.send(command);
        return lead;
    }

    async createWithAssignment(lead, userId) {
        const timestamp = getISTTimestamp();

        const command = new TransactWriteCommand({
            TransactItems: [
                {
                    Put: {
                        TableName: TABLE_NAME,
                        Item: lead
                    }
                },
                {
                    Update: {
                        TableName: USERS_TABLE,
                        Key: { id: userId },
                        UpdateExpression: "SET active_leads_count = active_leads_count + :inc, last_assigned_at = :time",
                        ExpressionAttributeValues: {
                            ":inc": 1,
                            ":time": timestamp
                        }
                    }
                }
            ]
        });

        await docClient.send(command);
        return lead;
    }

    async findById(id) {
        const command = new GetCommand({
            TableName: TABLE_NAME,
            Key: { id }
        });
        const response = await docClient.send(command);
        return response.Item;
    }

    async update(id, updateExpression, expressionAttributeNames, expressionAttributeValues) {
        const command = new UpdateCommand({
            TableName: TABLE_NAME,
            Key: { id },
            UpdateExpression: updateExpression,
            ExpressionAttributeNames: expressionAttributeNames,
            ExpressionAttributeValues: expressionAttributeValues,
            ReturnValues: 'ALL_NEW'
        });
        const response = await docClient.send(command);
        return response.Attributes;
    }

    async findByEmailOrPhone(email, phone) {
        // Scan is inefficient for large datasets, but without specific GSIs this is the fallback.
        // Optimally, we should have a GSI on email or phone.
        const filterParts = [];
        const values = {};

        if (email) {
            filterParts.push('email = :email');
            values[':email'] = email;
        }
        if (phone) {
            filterParts.push('phone = :phone');
            values[':phone'] = phone;
        }

        if (filterParts.length === 0) return null;

        const command = new ScanCommand({
            TableName: TABLE_NAME,
            FilterExpression: filterParts.join(' OR '),
            ExpressionAttributeValues: values
        });

        const response = await docClient.send(command);
        return response.Items.length > 0 ? response.Items[0] : null; // Return first match
    }

    async findAll(filter = {}, limit = 20, exclusiveStartKey = null) {
        const params = {
            TableName: TABLE_NAME,
            Limit: limit,
        };

        if (exclusiveStartKey) {
            try {
                params.ExclusiveStartKey = JSON.parse(Buffer.from(exclusiveStartKey, 'base64').toString('utf-8'));
            } catch (e) {
                // Invalid cursor, start from beginning
            }
        }

        if (Object.keys(filter).length > 0) {
            params.FilterExpression = Object.keys(filter)
                .map((key, index) => {
                    if (Array.isArray(filter[key])) {
                        // Handle IN clause for Arrays
                        // key IN (:val0, :val1, ...)
                        const valueKeys = filter[key].map((_, vIndex) => `:value${index}_${vIndex}`).join(', ');
                        return `#field${index} IN (${valueKeys})`;
                    } else {
                        // Handle Standard Equality
                        return `#field${index} = :value${index}`;
                    }
                })
                .join(' AND ');

            params.ExpressionAttributeNames = {};
            params.ExpressionAttributeValues = {};

            Object.keys(filter).forEach((key, index) => {
                params.ExpressionAttributeNames[`#field${index}`] = key;

                if (Array.isArray(filter[key])) {
                    // Map individual items in array to unique value keys
                    filter[key].forEach((val, vIndex) => {
                        params.ExpressionAttributeValues[`:value${index}_${vIndex}`] = val;
                    });
                } else {
                    params.ExpressionAttributeValues[`:value${index}`] = filter[key];
                }
            });
        }

        const command = new ScanCommand(params);
        const response = await docClient.send(command);

        let nextCursor = null;
        if (response.LastEvaluatedKey) {
            nextCursor = Buffer.from(JSON.stringify(response.LastEvaluatedKey)).toString('base64');
        }

        return {
            items: response.Items || [],
            cursor: nextCursor,
            count: response.Count
        };
    }

    async delete(id) {
        const command = new DeleteCommand({
            TableName: TABLE_NAME,
            Key: { id }
        });
        await docClient.send(command);
        return true;
    }
}

module.exports = new LeadRepository();
