const cron = require('node-cron');
const { docClient } = require('../config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { sendToUser } = require('../services/notificationService');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { getISTTimestamp } = require('../utils/timeUtils');

// Run every 5 minutes
const task = cron.schedule('*/5 * * * *', async () => {
    console.log('[Cron] Checking for Follow-up Reminders...');
    try {
        const now = new Date();
        const future = new Date(now.getTime() + 15 * 60000); // 15 mins from now

        const nowISO = now.toISOString();
        const futureISO = future.toISOString();

        // Scan for leads with follow_up in [now, now+15m]
        // Note: For production, use GSI on next_follow_up_date
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
            console.log(`[Cron] Found ${leads.length} due follow-ups.`);

            for (const lead of leads) {
                if (lead.assigned_to) {
                    await sendToUser(
                        lead.assigned_to,
                        'Call Reminder',
                        `Follow up with ${lead.name} (${lead.phone}) in 15 mins.`,
                        { type: 'follow_up', lead_id: lead.id }
                    );

                    // Optional: Update lead to prevent re-triggering? 
                    // Since scan is BETWEEN now and +15, next 5-min cron might pick it up again if it's still in window.
                    // But typically 'next_follow_up_date' should be cleared or moved after call.
                    // For now, allow duplicate reminder if agent doesn't act, or agent changes date.
                }
            }
        } else {
            // console.log('[Cron] No follow-ups due.');
        }

    } catch (error) {
        console.error('[Cron] Error:', error);
    }
});

module.exports = task;
