const { admin } = require('../config/firebase');
const { docClient } = require('../config/db');
const { PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { getISTTimestamp } = require('../utils/timeUtils');

const NOTIFICATIONS_TABLE = "Notifications";

// Send Notification (to a specific user)
const sendNotification = async (req, res) => {
    try {
        const { user_id, title, body, data } = req.body;

        if (!user_id || !title || !body) {
            return res.status(400).json({ message: 'user_id, title, and body are required' });
        }

        // 1. Get User's FCM Token
        const { GetCommand } = require("@aws-sdk/lib-dynamodb");
        const userCmd = new GetCommand({
            TableName: "Users", // Hardcoded User Table Name
            Key: { id: user_id }
        });
        const userResult = await docClient.send(userCmd);
        const fcmToken = userResult.Item?.fcm_token;

        if (!fcmToken) {
            return res.status(404).json({ message: 'User not found or has no registered device token' });
        }

        // 2. Send via Firebase
        const message = {
            token: fcmToken,
            notification: {
                title: title,
                body: body
            },
            data: data || {} // Optional key-value pairs
        };

        const response = await admin.messaging().send(message);

        // 3. Store in History (DynamoDB)
        const notificationId = require('uuid').v4();
        const notification = {
            user_id: user_id,
            timestamp: getISTTimestamp(),
            id: notificationId,
            title,
            body,
            data: data || {},
            fcm_message_id: response
        };

        await docClient.send(new PutCommand({
            TableName: NOTIFICATIONS_TABLE,
            Item: notification
        }));

        res.json({ message: 'Notification sent', firebase_response: response, notification_id: notificationId });

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

module.exports = { sendNotification, getNotifications };
