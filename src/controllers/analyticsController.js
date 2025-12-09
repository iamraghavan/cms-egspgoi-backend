const { docClient } = require('../config/db');
const { ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');
const { BUDGET_TABLE_NAME } = require('../models/budgetModel');
const { TABLE_NAME: AD_SPENDS_TABLE } = require('../models/adSpendModel');
const { TABLE_NAME: PAYMENT_RECORDS_TABLE } = require('../models/paymentRecordModel');

// Helper to scan all items (DynamoDB Scan is expensive, but okay for analytics in this scale)
const scanAll = async (TableName) => {
    let items = [];
    let lastEvaluatedKey = null;
    do {
        const command = new ScanCommand({ TableName, ExclusiveStartKey: lastEvaluatedKey });
        const result = await docClient.send(command);
        items = items.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return items;
};

const getAdminStats = async (req, res) => {
    try {
        const [users, leads, campaigns] = await Promise.all([
            scanAll(USERS_TABLE),
            scanAll(LEADS_TABLE),
            scanAll(CAMPAIGNS_TABLE)
        ]);

        const stats = {
            totalUsers: users.length,
            totalLeads: leads.length,
            totalCampaigns: campaigns.length,
            activeCampaigns: campaigns.filter(c => c.status === 'active').length,
            leadsByStatus: leads.reduce((acc, lead) => {
                acc[lead.status] = (acc[lead.status] || 0) + 1;
                return acc;
            }, {})
        };

        res.json(stats);
    } catch (error) {
        console.error("Admin Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch admin stats" });
    }
};

const getMarketingStats = async (req, res) => {
    try {
        const [campaigns, adSpends, leads] = await Promise.all([
            scanAll(CAMPAIGNS_TABLE),
            scanAll(AD_SPENDS_TABLE),
            scanAll(LEADS_TABLE)
        ]);

        const totalSpend = adSpends.reduce((sum, record) => sum + (record.actual_spend || 0), 0);
        const totalBudget = campaigns.reduce((sum, c) => sum + (c.budget || 0), 0); // Assuming budget is in campaign or linked budget table

        const stats = {
            activeCampaigns: campaigns.filter(c => c.status === 'active').length,
            totalSpend,
            totalLeads: leads.length,
            campaignPerformance: campaigns.map(c => {
                const campaignLeads = leads.filter(l => l.utm_params?.utm_campaign === c.name || l.source_website === c.platform);
                const campaignSpend = adSpends.filter(s => s.campaign_id === c.id).reduce((sum, s) => sum + s.actual_spend, 0);
                return {
                    id: c.id,
                    name: c.name,
                    leads: campaignLeads.length,
                    spend: campaignSpend,
                    cpl: campaignLeads.length > 0 ? (campaignSpend / campaignLeads.length).toFixed(2) : 0
                };
            })
        };

        res.json(stats);
    } catch (error) {
        console.error("Marketing Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch marketing stats" });
    }
};

const getAdmissionStats = async (req, res) => {
    try {
        const leads = await scanAll(LEADS_TABLE);
        
        const stats = {
            totalLeads: leads.length,
            leadsByStatus: leads.reduce((acc, lead) => {
                acc[lead.status] = (acc[lead.status] || 0) + 1;
                return acc;
            }, {}),
            leadsBySource: leads.reduce((acc, lead) => {
                const source = lead.source_website || 'Unknown';
                acc[source] = (acc[source] || 0) + 1;
                return acc;
            }, {})
        };

        res.json(stats);
    } catch (error) {
        console.error("Admission Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch admission stats" });
    }
};

const getFinanceStats = async (req, res) => {
    try {
        const [budgets, payments, adSpends] = await Promise.all([
            scanAll(BUDGET_TABLE_NAME),
            scanAll(PAYMENT_RECORDS_TABLE),
            scanAll(AD_SPENDS_TABLE)
        ]);

        const stats = {
            pendingBudgets: budgets.filter(b => b.status === 'pending').length,
            totalApprovedBudget: budgets.filter(b => b.status === 'approved').reduce((sum, b) => sum + b.amount, 0),
            totalPaymentsReceived: payments.reduce((sum, p) => sum + p.amount, 0),
            totalAdSpend: adSpends.reduce((sum, s) => sum + s.actual_spend, 0)
        };

        res.json(stats);
    } catch (error) {
        console.error("Finance Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch finance stats" });
    }
};

const getExecutiveStats = async (req, res) => {
    try {
        const userId = req.user.id;
        // In a real app, we would query by GSI assigned_to
        // For now, scanning all and filtering (inefficient but functional for prototype)
        const allLeads = await scanAll(LEADS_TABLE);
        const myLeads = allLeads.filter(l => l.assigned_to === userId);

        const stats = {
            totalAssignedLeads: myLeads.length,
            myLeadsByStatus: myLeads.reduce((acc, lead) => {
                acc[lead.status] = (acc[lead.status] || 0) + 1;
                return acc;
            }, {})
        };

        res.json(stats);
    } catch (error) {
        console.error("Executive Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch executive stats" });
    }
};

module.exports = {
    getAdminStats,
    getMarketingStats,
    getAdmissionStats,
    getFinanceStats,
    getExecutiveStats
};
