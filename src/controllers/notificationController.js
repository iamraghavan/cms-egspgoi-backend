const { sendToUser } = require('../services/notificationService');
const { docClient } = require('../config/db');
const { QueryCommand } = require("@aws-sdk/lib-dynamodb");

const NOTIFICATIONS_TABLE = "Notifications";

// Send Notification (to a specific user)
const sendNotification = async (req, res) => {
    try {
        const { user_id, title, body, data } = req.body;

        if (!user_id || !title || !body) {
            return res.status(400).json({ message: 'user_id, title, and body are required' });
        }

        const result = await sendToUser(user_id, title, body, data);

        if (result.success) {
            res.json({ message: 'Notification sent', ...result });
        } else {
            res.status(500).json({ message: 'Failed to send notification', error: result.error });
        }

    } catch (error) {
        console.error('Send Notification Error:', error);
        res.status(500).json({ message: 'Failed to send notification', error: error.message });
    }
};

// Get Notification History (for logged-in user)
const getNotifications = async (req, res) => {
    try {
        const { id } = req.user; // Authenticated User ID

        const command = new QueryCommand({
            TableName: NOTIFICATIONS_TABLE,
            KeyConditionExpression: "user_id = :uid",
            ExpressionAttributeValues: {
                ":uid": id
            },
            ScanIndexForward: false // Newest first
        });

        const result = await docClient.send(command);
        res.json({ notifications: result.Items });

    } catch (error) {
        console.error('Get Notifications Error:', error);
        res.status(500).json({ message: 'Failed to fetch notifications' });
    }
};

const { UpdateCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

// Mark Single Notification as Read
const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const timestamp = req.body.timestamp; // Required for range key if composite key is used

        // If schema is user_id (Partition) + timestamp (Sort), we NEED timestamp.
        // If sorting key is timestamp, we cannot delete/update efficiently without it unless using a secondary index (GSI/LSI) or retrieving first.
        // Assuming user sends the notification object which contains timestamp.

        if (!timestamp) return res.status(400).json({ message: 'Timestamp is required to identify the notification' });

        const command = new UpdateCommand({
            TableName: NOTIFICATIONS_TABLE,
            Key: {
                user_id: userId,
                timestamp: timestamp
            },
            UpdateExpression: "set #r = :true",
            ExpressionAttributeNames: { "#r": "read" },
            ExpressionAttributeValues: { ":true": true },
            ReturnValues: "ALL_NEW"
        });

        const result = await docClient.send(command);
        res.json({ message: 'Marked as read', notification: result.Attributes });

    } catch (error) {
        console.error('Mark Read Error:', error);
        res.status(500).json({ message: 'Failed to update notification' });
    }
};

// Mark All as Read
const markAllAsRead = async (req, res) => {
    try {
        const userId = req.user.id;

        // 1. Fetch all unread (Using Query or Scan if no index)
        // Since we want to update only unread, and we don't have GSI yet, we query all and filter in app, or use Scan.
        // Query is better.
        const queryCmd = new QueryCommand({
            TableName: NOTIFICATIONS_TABLE,
            KeyConditionExpression: "user_id = :uid",
            FilterExpression: "#r = :false",
            ExpressionAttributeNames: { "#r": "read" },
            ExpressionAttributeValues: { ":uid": userId, ":false": false }
        });

        const result = await docClient.send(queryCmd);
        const unreadItems = result.Items || [];

        // 2. Parallel Update
        // DynamoDB doesn't support "Update Where". Must update items individually.
        const updatePromises = unreadItems.map(item =>
            docClient.send(new UpdateCommand({
                TableName: NOTIFICATIONS_TABLE,
                Key: { user_id: userId, timestamp: item.timestamp },
                UpdateExpression: "set #r = :true",
                ExpressionAttributeNames: { "#r": "read" },
                ExpressionAttributeValues: { ":true": true }
            }))
        );

        await Promise.all(updatePromises);
        res.json({ message: 'Marked all as read', count: unreadItems.length });

    } catch (error) {
        console.error('Mark All Read Error:', error);
        res.status(500).json({ message: 'Failed to update notifications' });
    }
};

module.exports = { sendNotification, getNotifications, markAsRead, markAllAsRead };
