const { docClient } = require('../config/db');
const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { sendToUser } = require('../services/notificationService');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { CMS_PAGES_TABLE, CMS_POSTS_TABLE } = require('../models/cmsModel');
const logger = require('../utils/logger');

/**
 * Trigger: Follow-up Reminders
 * Scans for leads due for follow-up in the next 15 minutes.
 */
const processNotifications = async (req, res) => {
    logger.info('[Vercel Cron] Processing Follow-up Reminders...');
    try {
        const now = new Date();
        const future = new Date(now.getTime() + 15 * 60000); 

        const nowISO = now.toISOString();
        const futureISO = future.toISOString();

        const command = new ScanCommand({
            TableName: LEADS_TABLE,
            FilterExpression: "next_follow_up_date BETWEEN :start AND :end AND is_deleted = :false",
            ExpressionAttributeValues: {
                ":start": nowISO,
                ":end": futureISO,
                ":false": false
            }
        });

        const result = await docClient.send(command);
        const leads = result.Items || [];

        if (leads.length > 0) {
            logger.info(`[Vercel Cron] Found ${leads.length} due follow-ups.`);
            for (const lead of leads) {
                if (lead.assigned_to) {
                    await sendToUser(
                        lead.assigned_to,
                        'Call Reminder',
                        `Follow up with ${lead.name} (${lead.phone}) in 15 mins.`,
                        { type: 'follow_up', lead_id: lead.id }
                    );
                }
            }
        }

        return res.status(200).json({ 
            status: 'success', 
            message: `Processed ${leads.length} follow-ups` 
        });

    } catch (error) {
        logger.error('[Vercel Cron] Notification Error:', error.message);
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

/**
 * Trigger: CMS Scheduled Publishing
 * Scans for content scheduled to go live.
 */
const processCmsPublishing = async (req, res) => {
    logger.info('[Vercel Cron] Processing CMS Scheduled Publishing...');
    try {
        const nowISO = new Date().toISOString();
        let publishedCount = 0;

        // 1. Process Pages
        const pagesRes = await docClient.send(new ScanCommand({
            TableName: CMS_PAGES_TABLE,
            FilterExpression: "#s = :draft AND scheduled_at <= :now",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":draft": "draft", ":now": nowISO }
        }));

        const pages = pagesRes.Items || [];
        for (const page of pages) {
            const updated = { ...page, status: 'published', published_at: nowISO, updated_at: nowISO };
            await docClient.send(new PutCommand({ TableName: CMS_PAGES_TABLE, Item: updated }));
            publishedCount++;
        }

        // 2. Process Posts
        const postsRes = await docClient.send(new ScanCommand({
            TableName: CMS_POSTS_TABLE,
            FilterExpression: "#s = :draft AND scheduled_at <= :now",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":draft": "draft", ":now": nowISO }
        }));

        const posts = postsRes.Items || [];
        for (const post of posts) {
            const updated = { ...post, status: 'published', published_at: nowISO, updated_at: nowISO };
            await docClient.send(new PutCommand({ TableName: CMS_POSTS_TABLE, Item: updated }));
            publishedCount++;
        }

        return res.status(200).json({ 
            status: 'success', 
            message: `Successfully published ${publishedCount} items` 
        });

    } catch (error) {
        logger.error('[Vercel Cron] CMS Error:', error.message);
        return res.status(500).json({ status: 'error', message: error.message });
    }
};

module.exports = {
    processNotifications,
    processCmsPublishing
};
