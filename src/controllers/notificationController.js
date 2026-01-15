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

module.exports = { sendNotification, getNotifications };
