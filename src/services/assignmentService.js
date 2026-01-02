const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { docClient } = require('../config/db');
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: ROLES_TABLE } = require('../models/roleModel');
const logger = require('../utils/logger');

// Simple in-memory cache for role IDs to avoid fetching on every request
let roleCache = {};
let lastRoleFetch = 0;
const CACHE_TTL = 300000; // 5 minutes

const getRoleIds = async () => {
    const now = Date.now();
    if (roleCache.manager && roleCache.exec && (now - lastRoleFetch < CACHE_TTL)) {
        return roleCache;
    }

    try {
        const command = new ScanCommand({
            TableName: ROLES_TABLE
        });
        const result = await docClient.send(command);
        const roles = result.Items || [];

        const manager = roles.find(r => r.name === 'Admission Manager');
        const exec = roles.find(r => r.name === 'Admission Executive');

        roleCache = {
            manager: manager ? manager.id : null,
            exec: exec ? exec.id : null
        };
        lastRoleFetch = now;
        return roleCache;
    } catch (error) {
        logger.error('Error fetching roles:', error);
        return {};
    }
};

/**
 * Finds the best available agent for lead assignment.
 * Logic: "Weighted Equal Distribution"
 * 1. Filter by Role ID (Manager/Executive) & Availability.
 * 2. Calculate Score = active_leads_count / weightage.
 * 3. Sort by Score (ASC).
 * 4. Tie-break:
 *    - Last Assigned At (ASC) - oldest first
 *    - Active Leads Count (ASC) - lowest first
 */
const findBestAgent = async () => {
    try {
        const { manager: managerId, exec: execId } = await getRoleIds();

        if (!managerId && !execId) {
            logger.warn('Admission roles not found in DB.');
            return null;
        }

        // Build filter expression dynamically based on found roles
        let filterExp = "";
        const expValues = { ":true": true };

        if (managerId && execId) {
            filterExp = "(role_id = :manager OR role_id = :exec) AND is_available = :true";
            expValues[":manager"] = managerId;
            expValues[":exec"] = execId;
        } else if (managerId) {
            filterExp = "role_id = :manager AND is_available = :true";
            expValues[":manager"] = managerId;
        } else {
            filterExp = "role_id = :exec AND is_available = :true";
            expValues[":exec"] = execId;
        }

        const command = new ScanCommand({
            TableName: USERS_TABLE,
            FilterExpression: filterExp,
            ExpressionAttributeValues: expValues
        });

        const result = await docClient.send(command);
        const candidates = result.Items || [];

        if (candidates.length === 0) {
            return null;
        }

        // Sort candidates
        candidates.sort((a, b) => {
            const weightA = a.weightage || 1;
            const weightB = b.weightage || 1;
            const leadsA = a.active_leads_count || 0;
            const leadsB = b.active_leads_count || 0;

            const scoreA = leadsA / weightA;
            const scoreB = leadsB / weightB;

            // 1. Primary: Assignment Score
            if (Math.abs(scoreA - scoreB) > 0.01) { // Float comparison
                return scoreA - scoreB;
            }

            // 2. Secondary: Longest time since last assignment (Oldest timestamp first)
            const timeA = a.last_assigned_at ? new Date(a.last_assigned_at).getTime() : 0;
            const timeB = b.last_assigned_at ? new Date(b.last_assigned_at).getTime() : 0;

            if (timeA !== timeB) {
                return timeA - timeB;
            }

            // 3. Tertiary: Absolute active leads count
            return leadsA - leadsB;
        });

        const winner = candidates[0];
        if (winner) {
            if (winner.role_id === managerId) winner.role_name = 'Admission Manager';
            else if (winner.role_id === execId) winner.role_name = 'Admission Executive';
        }

        return winner; // The winner
    } catch (error) {
        logger.error('Find Best Agent Error:', error);
        return null; // Fail safe
    }
};

module.exports = { findBestAgent };
