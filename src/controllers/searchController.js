const { docClient } = require('../config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');

/**
 * Calculate Levenshtein Distance for strings a and b
 */
const levenshteinDistance = (a, b) => {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1, // substitution
                    Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1) // insertion, deletion
                );
            }
        }
    }
    return matrix[b.length][a.length];
};

/**
 * Calculate match score
 * 100 = Exact
 * 80 = Starts With
 * 60 = Contains
 * 40-10 = Fuzzy (based on distance)
 */
const getMatchScore = (text, query) => {
    if (!text) return 0;
    const t = text.toString().toLowerCase();
    const q = query.toLowerCase();

    if (t === q) return 100;
    if (t.startsWith(q)) return 80;
    if (t.includes(q)) return 60;

    // Fuzzy Check (only if query is reasonable length to avoid noise)
    if (q.length > 3) {
        const dist = levenshteinDistance(t, q);
        // Allow 1 error per 4 chars roughly
        const maxDist = Math.floor(q.length / 3);
        if (dist <= maxDist) {
            return 50 - (dist * 10);
        }
    }
    return 0;
};

const searchTable = async (TableName, query, fields) => {
    try {
        const command = new ScanCommand({ TableName });
        const result = await docClient.send(command);
        const items = result.Items || [];

        // Score items
        const scoredItems = items.map(item => {
            let bestScore = 0;
            fields.forEach(field => {
                const score = getMatchScore(item[field], query);
                if (score > bestScore) bestScore = score;
            });
            return { ...item, _score: bestScore };
        });

        // Filter and Sort by Score
        return scoredItems
            .filter(item => item._score > 0)
            .sort((a, b) => b._score - a._score)
            .slice(0, 5); // Top 5
    } catch (error) {
        console.error(`Search error in ${TableName}:`, error);
        return [];
    }
};

const globalSearch = async (req, res) => {
    const { q } = req.query;
    const userRole = req.user.role;

    if (!q || q.length < 3) {
        return res.status(400).json({ message: "Search query must be at least 3 characters long" });
    }

    try {
        const searchPromises = [];
        const results = {};

        // 1. Leads Search (Admission Team & Admin)
        if (['Super Admin', 'Admission Manager', 'Admission Executive', 'Marketing Manager'].includes(userRole)) {
            searchPromises.push(
                searchTable(LEADS_TABLE, q, ['name', 'email', 'phone']).then(res => results.leads = res)
            );
        }

        // 2. Campaigns Search (Marketing, Admin, Admission Manager)
        if (['Super Admin', 'Marketing Manager', 'Admission Manager', 'Finance'].includes(userRole)) {
            searchPromises.push(
                searchTable(CAMPAIGNS_TABLE, q, ['name', 'platform']).then(res => results.campaigns = res)
            );
        }

        // 3. Users Search (Super Admin Only)
        if (userRole === 'Super Admin') {
            searchPromises.push(
                searchTable(USERS_TABLE, q, ['name', 'email']).then(res => results.users = res)
            );
        }

        await Promise.all(searchPromises);

        res.json(results);
    } catch (error) {
        console.error("Global Search Error:", error);
        res.status(500).json({ message: "Server error during search" });
    }
};

module.exports = { globalSearch };
