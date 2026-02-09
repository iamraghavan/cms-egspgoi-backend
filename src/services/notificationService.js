const { admin } = require('../config/firebase');
const { docClient } = require('../config/db');
const { PutCommand, GetCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { getISTTimestamp } = require('../utils/timeUtils');
const pusher = require('../config/pusher');

const NOTIFICATIONS_TABLE = "Notifications";
const USERS_TABLE = "Users";

const sendToUser = async (userId, title, body, data = {}) => {
    try {
        // 1. Get User's FCM Token
        const userCmd = new GetCommand({
            TableName: USERS_TABLE,
            Key: { id: userId }
        });
        const userResult = await docClient.send(userCmd);
        const fcmToken = userResult.Item?.fcm_token;

        let fcmMessageId = null;

        if (fcmToken) {
            // 2. Send via Firebase
            const message = {
                token: fcmToken,
                notification: {
                    title: title,
                    body: body
                },
                data: data || {}
            };
            try {
                fcmMessageId = await admin.messaging().send(message);
            } catch (fcmError) {
                console.error(`FCM Send Error for user ${userId}:`, fcmError.message);
                // Continue to save notification to DB even if push fails
            }
        }

        // 3. Store in History (DynamoDB)
        const notificationId = require('uuid').v4();
        const notification = {
            user_id: userId,
            timestamp: getISTTimestamp(),
            id: notificationId,
            title,
            body,
            data: data || {},
            fcm_message_id: fcmMessageId,
            read: false
        };

        await docClient.send(new PutCommand({
            TableName: NOTIFICATIONS_TABLE,
            Item: notification
        }));

        // 4. Trigger Real-time Event via Pusher
        try {
            await pusher.trigger(`private-user-${userId}`, 'new-notification', {
                id: notificationId,
                title,
                body,
                timestamp: notification.timestamp,
                data: data || {}
            });
        } catch (pusherError) {
            console.error(`Pusher Trigger Error for user ${userId}:`, pusherError.message);
        }

        return { success: true, notificationId, fcmMessageId };

    } catch (error) {
        console.error('Notification Service Error:', error);
        return { success: false, error: error.message };
    }
};

const sendToRole = async (roleName, title, body, data = {}) => {
    try {
        // Find Role ID
        const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');
        const roleScan = new ScanCommand({
            TableName: ROLES_TABLE,
            FilterExpression: "#name = :name",
            ExpressionAttributeNames: { "#name": "name" },
            ExpressionAttributeValues: { ":name": roleName }
        });
        const roleResult = await docClient.send(roleScan);

        if (roleResult.Items.length === 0) {
            console.log(`Role ${roleName} not found`);
            return;
        }
        const roleId = roleResult.Items[0].id;

        // Find Users with this Role
        const userScan = new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: "role_id = :rid",
            ExpressionAttributeValues: { ":rid": roleId }
        });
        const userResult = await docClient.send(userScan);

        const promises = userResult.Items.map(user =>
            sendToUser(user.id, title, body, data)
        );

        await Promise.all(promises);

    } catch (error) {
        console.error('Send to Role Error:', error);
    }
};

module.exports = { sendToUser, sendToRole };
