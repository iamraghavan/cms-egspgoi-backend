const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require('../config/db');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const logger = require('../utils/logger');

/**
 * Finds the best available agent for lead assignment.
 * Logic: "Least Active Leads" (Smart Load Balancing)
 * 1. Filter by Role (Manager/Executive) & Availability.
 * 2. Sort by active_leads_count (ASC).
 * 3. Tie-break with last_assigned_at (ASC).
 */
const findBestAgent = async () => {
    try {
        // Scan all users (Efficient enough for <1000 staff)
        // In production with 10k+ staff, use GSI on role+availability
        const command = new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: "(#role = :manager OR #role = :exec) AND is_available = :true",
            ExpressionAttributeNames: {
                "#role": "role"
            },
            ExpressionAttributeValues: {
                ":manager": "Admission Manager",
                ":exec": "Admission Executive",
                ":true": true
            }
        });

        const result = await docClient.send(command);
        const candidates = result.Items || [];

        if (candidates.length === 0) {
            return null;
        }

        // Sort candidates
        candidates.sort((a, b) => {
            // Primary: Least active leads
            const leadsA = a.active_leads_count || 0;
            const leadsB = b.active_leads_count || 0;
            if (leadsA !== leadsB) {
                return leadsA - leadsB;
            }

            // Secondary: Longest time since last assignment (Oldest timestamp first)
            // If last_assigned_at is null, treat as very old (priority)
            const timeA = a.last_assigned_at ? new Date(a.last_assigned_at).getTime() : 0;
            const timeB = b.last_assigned_at ? new Date(b.last_assigned_at).getTime() : 0;
            return timeA - timeB;
        });

        return candidates[0]; // The winner
    } catch (error) {
        logger.error('Find Best Agent Error:', error);
        return null; // Fail safe
    }
};

module.exports = { findBestAgent };
