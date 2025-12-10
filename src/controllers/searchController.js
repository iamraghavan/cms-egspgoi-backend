const { docClient } = require('../config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');

const searchTable = async (TableName, query, fields) => {
    try {
        // Note: Scan is inefficient for large datasets. 
        // For production with millions of records, use CloudSearch or ElasticSearch.
        // For this scale, Scan with filter is acceptable.
        
        const lowerQuery = query.toLowerCase();
        
        const command = new ScanCommand({
            TableName,
        });
        
        const result = await docClient.send(command);
        const items = result.Items || [];
        
        // In-memory filtering for flexibility with "contains" logic across multiple fields
        return items.filter(item => {
            return fields.some(field => {
                const value = item[field];
                return value && value.toString().toLowerCase().includes(lowerQuery);
            });
        }).slice(0, 5); // Limit to top 5 results per category
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
