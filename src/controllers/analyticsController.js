const { docClient } = require('../config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');
const { BUDGET_TABLE_NAME } = require('../models/budgetModel');
const { TABLE_NAME: AD_SPENDS_TABLE } = require('../models/adSpendModel');
const { TABLE_NAME: PAYMENT_RECORDS_TABLE } = require('../models/paymentRecordModel');
const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');

// Helper to scan all items
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

// --- SUPER ADMIN ---
const getAdminStats = async (req, res) => {
    try {
        const [users, leads, campaigns, payments, adSpends] = await Promise.all([
            scanAll(USERS_TABLE),
            scanAll(LEADS_TABLE),
            scanAll(CAMPAIGNS_TABLE),
            scanAll(PAYMENT_RECORDS_TABLE),
            scanAll(AD_SPENDS_TABLE)
        ]);

        const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
        const totalAdSpend = adSpends.reduce((sum, s) => sum + s.actual_spend, 0);

        // Funnel Logic
        const funnel = {
            'New': leads.filter(l => l.status === 'new').length,
            'Contacted': leads.filter(l => l.status === 'contacted' || l.status === 'called').length,
            'Interested': leads.filter(l => l.status === 'interested' || l.status === 'visited').length,
            'Enrolled': leads.filter(l => l.status === 'enrolled' || l.status === 'converted').length
        };

        const stats = {
            overview: {
                totalLeads: leads.length,
                totalUsers: users.length, // Consider filtering active only
                revenue: totalRevenue,
                adSpend: totalAdSpend,
                activeCampaigns: campaigns.filter(c => c.status === 'active').length
            },
            funnel,
            recentActivity: leads.slice(0, 5).map(l => ({ // Mock activity from latest leads
                message: `New Lead: ${l.name}`,
                time: l.created_at
            })),
            metrics: {
                conversionRate: leads.length > 0 ? ((funnel.Enrolled / leads.length) * 100).toFixed(1) : 0,
                roi: totalAdSpend > 0 ? ((totalRevenue - totalAdSpend) / totalAdSpend * 100).toFixed(1) : 0
            }
        };

        res.json(stats);
    } catch (error) {
        console.error("Admin Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch admin stats" });
    }
};

// --- ADMISSION MANAGER ---
const getAdmissionStats = async (req, res) => {
    try {
        const [leads, users] = await Promise.all([
            scanAll(LEADS_TABLE),
            scanAll(USERS_TABLE)
        ]);

        // Define "Today"
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

        const unassignedCount = leads.filter(l => !l.assigned_to || l.assigned_to === 'unassigned').length;

        // Today's Conversions
        // Note: created_at is not good for "Conversion Date", but update_at is noisy.
        // Ideally we need status_history. For MVP, we check status=Enrolled AND updated_at=Today
        const todayConversions = leads.filter(l =>
            (l.status === 'Enrolled' || l.status === 'Converted') &&
            new Date(l.updated_at).getTime() >= startOfDay
        ).length;

        // Leaderboard
        const agentMap = {};
        leads.forEach(l => {
            if (l.assigned_to) {
                if (!agentMap[l.assigned_to]) agentMap[l.assigned_to] = { leads: 0, conversions: 0 };
                agentMap[l.assigned_to].leads++;
                if (l.status === 'Enrolled' || l.status === 'Converted') agentMap[l.assigned_to].conversions++;
            }
        });

        // Enrich with Names
        const leaderboard = Object.keys(agentMap).map(uid => {
            const user = users.find(u => u.id === uid);
            return {
                id: uid,
                name: user ? user.name : 'Unknown',
                ...agentMap[uid]
            };
        }).sort((a, b) => b.conversions - a.conversions).slice(0, 5); // Top 5

        const stats = {
            unassignedLeads: unassignedCount,
            todayConversions,
            totalLeads: leads.length,
            leaderboard,
            sourceBreakdown: leads.reduce((acc, lead) => {
                const src = lead.source_website || 'Unknown';
                acc[src] = (acc[src] || 0) + 1;
                return acc;
            }, {})
        };

        res.json(stats);
    } catch (error) {
        console.error("Admission Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch admission stats" });
    }
};

// --- FINANCE ---
const getFinanceStats = async (req, res) => {
    try {
        const [budgets, payments, adSpends] = await Promise.all([
            scanAll(BUDGET_TABLE_NAME),
            scanAll(PAYMENT_RECORDS_TABLE),
            scanAll(AD_SPENDS_TABLE)
        ]);

        const stats = {
            overview: {
                totalAdSpend: adSpends.reduce((sum, s) => sum + s.actual_spend, 0),
                totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
                allocatedBudget: budgets.filter(b => b.status === 'approved').reduce((sum, b) => sum + b.amount, 0)
            },
            pendingApprovals: budgets.filter(b => b.status === 'pending').length,
            recentTransactions: payments.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5)
        };

        res.json(stats);
    } catch (error) {
        console.error("Finance Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch finance stats" });
    }
};

// --- ADMISSION EXECUTIVE ---
const getExecutiveStats = async (req, res) => {
    try {
        const userId = req.user.id;
        const leads = await scanAll(LEADS_TABLE);
        const myLeads = leads.filter(l => l.assigned_to === userId);

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"
        // Adjust for IST/Timezone if needed, but simple string compare usually works if consistent

        // Tasks Logic
        const pendingFollowUps = myLeads.filter(l => {
            if (!l.next_follow_up_date) return false;
            // Check if date part matches, or if it's in the past (Overdue)
            // Assuming next_follow_up_date is ISO string
            return l.next_follow_up_date.startsWith(todayStr) || l.next_follow_up_date < now.toISOString();
        });

        const myConversions = myLeads.filter(l => l.status === 'Enrolled' || l.status === 'Converted').length;

        const stats = {
            myTotalLeads: myLeads.length,
            todayTasks: pendingFollowUps.length, // Number of items in "Today's Work"
            myConversions,
            tasks: pendingFollowUps.map(l => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                time: l.next_follow_up_date,
                isOverdue: l.next_follow_up_date < now.toISOString()
            })),
            performance: {
                conversionRate: myLeads.length > 0 ? ((myConversions / myLeads.length) * 100).toFixed(1) : 0,
                target: 10 // Hardcoded monthly target for now
            }
        };

        res.json(stats);
    } catch (error) {
        console.error("Executive Stats Error:", error);
        res.status(500).json({ message: "Failed to fetch executive stats" });
    }
};

// Marketing Stats (Unchanged but included for completeness)
const getMarketingStats = async (req, res) => {
    try {
        const [campaigns, adSpends, leads] = await Promise.all([
            scanAll(CAMPAIGNS_TABLE),
            scanAll(AD_SPENDS_TABLE),
            scanAll(LEADS_TABLE)
        ]);

        const totalSpend = adSpends.reduce((sum, record) => sum + (record.actual_spend || 0), 0);

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

module.exports = {
    getAdminStats,
    getMarketingStats,
    getAdmissionStats,
    getFinanceStats,
    getExecutiveStats
};
