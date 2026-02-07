const cron = require('node-cron');
const { docClient } = require('../config/db');
const { ScanCommand, PutCommand } = require("@aws-sdk/lib-dynamodb");
const { CMS_PAGES_TABLE, CMS_POSTS_TABLE } = require('../models/cmsModel');

/**
 * CMS Cron: Scheduled Publishing
 * Runs every hour to check for content scheduled to go live.
 */
const task = cron.schedule('0 * * * *', async () => {
    console.log('[Cron] Checking for Scheduled CMS Content...');
    try {
        const nowISO = new Date().toISOString();

        // 1. Process Pages
        const pagesRes = await docClient.send(new ScanCommand({
            TableName: CMS_PAGES_TABLE,
            FilterExpression: "#s = :draft AND scheduled_at <= :now",
            ExpressionAttributeNames: { "#s": "status" },
            ExpressionAttributeValues: { ":draft": "draft", ":now": nowISO }
        }));

        const pages = pagesRes.Items || [];
        for (const page of pages) {
            console.log(`[Cron] Publishing Page: ${page.title} (${page.id})`);
            const updated = {
                ...page,
                status: 'published',
                published_at: nowISO,
                updated_at: nowISO
            };
            await docClient.send(new PutCommand({ TableName: CMS_PAGES_TABLE, Item: updated }));
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
            console.log(`[Cron] Publishing Post: ${post.title} (${post.id})`);
            const updated = {
                ...post,
                status: 'published',
                published_at: nowISO,
                updated_at: nowISO
            };
            await docClient.send(new PutCommand({ TableName: CMS_POSTS_TABLE, Item: updated }));
        }

        if (pages.length > 0 || posts.length > 0) {
            console.log(`[Cron] Successfully published ${pages.length} pages and ${posts.length} posts.`);
        }

    } catch (error) {
        console.error('[Cron] CMS Scheduled Publishing Error:', error);
    }
});

module.exports = task;
