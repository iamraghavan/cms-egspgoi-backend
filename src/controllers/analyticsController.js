const { docClient } = require('../config/db');
const { ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { TABLE_NAME: USERS_TABLE } = require('../models/userModel');
const { TABLE_NAME: LEADS_TABLE } = require('../models/leadModel');
const { TABLE_NAME: CAMPAIGNS_TABLE } = require('../models/campaignModel');
const { CMS_POSTS_TABLE } = require('../models/cmsModel');
const { BUDGET_TABLE_NAME } = require('../models/budgetModel');
const { TABLE_NAME: AD_SPENDS_TABLE } = require('../models/adSpendModel');
const { TABLE_NAME: PAYMENT_RECORDS_TABLE } = require('../models/paymentRecordModel');
const { getISTTimestamp, parseISTTimestamp } = require('../utils/timeUtils');

// Helper to scan all items
const scanAll = async (TableName) => {
    let items = [];
    let lastEvaluatedKey = undefined; // Must be undefined for first call, NOT null
    do {
        const params = { TableName };
        if (lastEvaluatedKey) {
            params.ExclusiveStartKey = lastEvaluatedKey;
        }
        const command = new ScanCommand(params);
        const result = await docClient.send(command);
        items = items.concat(result.Items || []);
        lastEvaluatedKey = result.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    return items;
};

const asyncHandler = require('../utils/asyncHandler');

// --- SUPER ADMIN ---
const getAdminStats = asyncHandler(async (req, res) => {
    const { startDate, endDate, range } = req.query;

    // 1. Calculate Date Range
    const now = new Date();
    let start = new Date(0); // Default: All Time
    let end = new Date();

    if (startDate && endDate) {
        start = new Date(startDate);
        end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
    } else if (range) {
        const days = parseInt(range) || 30;
        start = new Date();
        start.setDate(now.getDate() - days);
    }

    const startTs = start.getTime();
    const endTs = end.getTime();

    // 2. Fetch Data (Scanning needed for filtering by non-key dates)
    const [users, leads, campaigns, payments, adSpends, posts] = await Promise.all([
        scanAll(USERS_TABLE),
        scanAll(LEADS_TABLE),
        scanAll(CAMPAIGNS_TABLE),
        scanAll(PAYMENT_RECORDS_TABLE),
        scanAll(AD_SPENDS_TABLE),
        scanAll(CMS_POSTS_TABLE)
    ]);

    // 3. Filter Data by Date
    // Helper to get Date object regardless of format (ISO vs DD/MM/YYYY - HH:MM:SS)
    const getItemDate = (item, dateField) => {
        if (!item[dateField]) return null;
        // Try parsing assuming custom IST format first if applicable, or rely on internal logic
        // But parseISTTimestamp handles ISO fallback too.
        return parseISTTimestamp(item[dateField]);
    };

    const dateFilter = (item, dateField = 'created_at') => {
        const dObj = getItemDate(item, dateField);
        if (!dObj) return false;
        const d = dObj.getTime();
        return d >= startTs && d <= endTs;
    };

    const filteredLeads = leads.filter(l => dateFilter(l));
    const filteredPayments = payments.filter(p => dateFilter(p, 'date'));
    const filteredAdSpends = adSpends.filter(s => dateFilter(s, 'date'));
    const filteredPosts = posts.filter(p => dateFilter(p));

    // 4. Calculate KPIs
    const totalRevenue = filteredPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const totalAdSpend = filteredAdSpends.reduce((sum, s) => sum + (s.actual_spend || 0), 0);
    const totalLeads = filteredLeads.length;
    const totalActiveLeads = filteredLeads.filter(l => !['Lost', 'Dropped', 'lost', 'dropped'].includes(l.status)).length;

    // KPI Cards
    const kpi = {
        total_leads: { value: totalLeads, label: 'Total Leads' },
        ad_spend: { value: totalAdSpend, label: 'Ad Spend' },
        active_users: { value: users.filter(u => !u.is_deleted).length, label: 'Active Users' },
        total_posts: { value: filteredPosts.length, label: 'Total Posts' },
        active_leads: { value: totalActiveLeads, label: 'Active Leads' },
        revenue: { value: totalRevenue, label: 'Total Revenue' }
    };

    // 5. Funnel (Based on current status of filtered leads)
    const funnel = {
        'New': filteredLeads.filter(l => l.status === 'new').length,
        'Contacted': filteredLeads.filter(l => ['contacted', 'called', 'follow_up'].includes(l.status)).length,
        'Interested': filteredLeads.filter(l => ['interested', 'visited'].includes(l.status)).length,
        'Enrolled': filteredLeads.filter(l => ['enrolled', 'converted'].includes(l.status)).length,
        'Lost': filteredLeads.filter(l => ['lost', 'dropped'].includes(l.status)).length
    };

    // 6. Trend Charts (Daily Breakdown)
    const getDailyTrend = (items, dateField = 'created_at', valueField = null) => {
        const trend = {};
        items.forEach(item => {
            const dObj = getItemDate(item, dateField);
            if (!dObj) return;
            const d = dObj.toISOString().split('T')[0]; // YYYY-MM-DD
            if (!trend[d]) trend[d] = 0;
            trend[d] += valueField ? (item[valueField] || 0) : 1;
        });
        return Object.keys(trend).sort().map(date => ({ date, value: trend[date] }));
    };

    const charts = {
        leads_trend: getDailyTrend(filteredLeads),
        revenue_trend: getDailyTrend(filteredPayments, 'date', 'amount'),
        spend_trend: getDailyTrend(filteredAdSpends, 'date', 'actual_spend')
    };

    // 7. Recent Activity (Global)
    const activity = [];
    filteredLeads.forEach(l => activity.push({ type: 'lead', message: `New Lead: ${l.name}`, time: l.created_at }));
    filteredPayments.forEach(p => activity.push({ type: 'payment', message: `Revenue: ₹${p.amount}`, time: p.date }));

    // Sort using custom parser for time field
    const recentActivity = activity.sort((a, b) => {
        const timeA = parseISTTimestamp(a.time).getTime();
        const timeB = parseISTTimestamp(b.time).getTime();
        return timeB - timeA;
    }).slice(0, 10);

    res.json({
        meta: { startDate: start.toISOString(), endDate: end.toISOString() },
        kpi,
        funnel,
        charts,
        recentActivity
    });
});

// --- ADMISSION MANAGER ---
const getAdmissionStats = async (req, res) => {
    try {
        const { startDate, endDate, range } = req.query;

        // 1. Calculate Date Range (Identical logic to Admin)
        const now = new Date();
        let start = new Date(0);
        let end = new Date();

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else if (range) {
            const days = parseInt(range) || 30;
            start = new Date();
            start.setDate(now.getDate() - days);
        }

        const startTs = start.getTime();
        const endTs = end.getTime();

        const [leads, users] = await Promise.all([
            scanAll(LEADS_TABLE),
            scanAll(USERS_TABLE)
        ]);

        // 2. Filter Leads by Date (Created At)
        const filteredLeads = leads.filter(l => {
            if (!l.created_at) return false;
            const d = new Date(l.created_at).getTime();
            if (isNaN(d)) return false; // Safety Check
            return d >= startTs && d <= endTs;
        });

        // 3. Snapshot Metrics (Ignore Date Range for "Current State")
        const unassignedCount = leads.filter(l => !l.assigned_to || l.assigned_to === 'unassigned').length;

        // 4. KPIs (Based on filtered range)
        const totalLeads = filteredLeads.length;
        const convertedLeads = filteredLeads.filter(l => ['Enrolled', 'Converted', 'enrolled', 'converted'].includes(l.status)).length;

        // 5. Leaderboard (Agent Performance in this Date Range)
        const agentMap = {};
        filteredLeads.forEach(l => {
            if (l.assigned_to && l.assigned_to !== 'unassigned') {
                if (!agentMap[l.assigned_to]) agentMap[l.assigned_to] = { leads: 0, conversions: 0 };
                agentMap[l.assigned_to].leads++;
                if (['Enrolled', 'Converted', 'enrolled', 'converted'].includes(l.status)) {
                    agentMap[l.assigned_to].conversions++;
                }
            }
        });

        const leaderboard = Object.keys(agentMap).map(uid => {
            const user = users.find(u => u.id === uid);
            const data = agentMap[uid];
            return {
                id: uid,
                name: user ? user.name : 'Unknown',
                leads: data.leads,
                conversions: data.conversions,
                conversionRate: data.leads > 0 ? ((data.conversions / data.leads) * 100).toFixed(1) : 0
            };
        }).sort((a, b) => b.conversions - a.conversions);

        // 6. Source Breakdown
        const sourceBreakdown = filteredLeads.reduce((acc, lead) => {
            const src = lead.source_website || 'Walk-in/Unknown';
            acc[src] = (acc[src] || 0) + 1;
            return acc;
        }, {});

        // 7. Charts: Daily Conversions & Leads
        const getDailyTrend = (items, dateField = 'created_at') => {
            const trend = {};
            items.forEach(item => {
                if (!item[dateField]) return;
                try {
                    const dObj = new Date(item[dateField]);
                    if (isNaN(dObj.getTime())) return;
                    const d = dObj.toISOString().split('T')[0];
                    if (!trend[d]) trend[d] = 0;
                    trend[d]++;
                } catch (e) {
                    // Ignore bad date
                }
            });
            return Object.keys(trend).sort().map(date => ({ date, value: trend[date] }));
        };

        const charts = {
            daily_leads: getDailyTrend(filteredLeads),
            daily_conversions: getDailyTrend(filteredLeads.filter(l => ['Enrolled', 'Converted', 'enrolled', 'converted'].includes(l.status)))
        };

        const stats = {
            meta: { startDate: start.toISOString(), endDate: end.toISOString() },
            kpi: {
                unassigned_leads: { value: unassignedCount, label: 'Unassigned (Total)' },
                total_leads_period: { value: totalLeads, label: 'New Leads (Period)' },
                conversions_period: { value: convertedLeads, label: 'Conversions (Period)' },
                conversion_rate: { value: totalLeads > 0 ? ((convertedLeads / totalLeads) * 100).toFixed(1) : 0, label: 'Conversion Rate %' }
            },
            leaderboard, // Array of agents
            source_breakdown: sourceBreakdown, // Object { 'google': 10 }
            charts
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
    console.log("DEBUG: Executive Stats Request Started");
    try {
        if (!req.user || !req.user.id) {
            console.error("Executive Stats Error: No user ID in request.");
            return res.status(401).json({ message: "Unauthorized: No User ID" });
        }
        const userId = req.user.id;
        console.log("DEBUG: User ID:", userId);
        const { startDate, endDate, range } = req.query;
        console.log("DEBUG: Query Params:", req.query);

        // 1. Calculate Date Range (For Historical Analytics)
        const now = new Date();
        let start = new Date(0);
        let end = new Date();

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
        } else if (range) {
            const days = parseInt(range) || 30;
            start = new Date();
            start.setDate(now.getDate() - days);
        }

        const startTs = start.getTime();
        const endTs = end.getTime();
        console.log("DEBUG: Date Range Calculated", { startTs, endTs });

        const leads = await scanAll(LEADS_TABLE);
        console.log("DEBUG: Leads Scanned. Count:", leads ? leads.length : "null");

        // 2. Filter: Assigned to ME + Created within Date Range
        const myLeadsHistory = leads.filter(l => {
            if (l.assigned_to !== userId) return false;
            // Date Filter
            if (!l.created_at) return false;
            const d = new Date(l.created_at).getTime();
            if (isNaN(d)) return false; // Safety Check
            return d >= startTs && d <= endTs;
        });
        console.log("DEBUG: Leads History Count:", myLeadsHistory.length);

        // 3. Operational Data (Live - Ignore Date Range)
        const myAllLeads = leads.filter(l => l.assigned_to === userId);
        const todayStr = now.toISOString().split('T')[0];

        const pendingFollowUps = myAllLeads.filter(l => {
            if (!l.next_follow_up_date) return false;
            // Safe Date Check
            const dStr = l.next_follow_up_date;
            if (!dStr || typeof dStr !== 'string') return false;
            // Simple check if it looks like a date or ISO string
            return (dStr.startsWith(todayStr) || dStr < now.toISOString());
        });
        console.log("DEBUG: Pending Followups Count:", pendingFollowUps.length);

        // 4. KPIs (Based on filtered range)
        const totalMyLeads = myLeadsHistory.length;
        const myConversions = myLeadsHistory.filter(l => ['Enrolled', 'Converted', 'enrolled', 'converted'].includes(l.status)).length;
        const conversionRate = totalMyLeads > 0 ? ((myConversions / totalMyLeads) * 100).toFixed(1) : 0;

        // 5. Trend Charts
        const getDailyTrend = (items, dateField = 'created_at') => {
            console.log("DEBUG: Entering getDailyTrend", items ? items.length : "null");
            const trend = {};
            if (!items) return []; // Safety
            items.forEach(item => {
                if (!item[dateField]) return;
                try {
                    const dObj = new Date(item[dateField]);
                    if (isNaN(dObj.getTime())) return; // Skip invalid
                    const d = dObj.toISOString().split('T')[0];
                    if (!trend[d]) trend[d] = 0;
                    trend[d]++;
                } catch (e) {
                    // Ignore bad dates
                }
            });
            console.log("DEBUG: Trend calculated");
            return Object.keys(trend).sort().map(date => ({ date, value: trend[date] }));
        };

        const charts = {
            daily_leads: getDailyTrend(myLeadsHistory),
            daily_conversions: getDailyTrend(myLeadsHistory.filter(l => ['Enrolled', 'Converted', 'enrolled', 'converted'].includes(l.status)))
        };
        console.log("DEBUG: Charts Generated");

        const stats = {
            meta: { startDate: start.toISOString(), endDate: end.toISOString() },
            kpi: {
                pending_followups: { value: pendingFollowUps.length, label: 'Pending Tasks (Live)' },
                total_leads: { value: totalMyLeads, label: 'My Leads (Period)' },
                my_conversions: { value: myConversions, label: 'My Conversions (Period)' },
                conversion_rate: { value: conversionRate, label: 'Success Rate %' }
            },
            charts,
            tasks: pendingFollowUps.map(l => ({
                id: l.id,
                name: l.name,
                phone: l.phone,
                time: l.next_follow_up_date,
                isOverdue: l.next_follow_up_date < now.toISOString()
            })),
            performance: {
                conversionRate,
                target: 10
            }
        };

        console.log("DEBUG: Sending Response");
        res.json(stats);
    } catch (error) {
        console.error("Executive Stats Error Stack:", error.stack);
        console.error("Executive Stats Error toString:", error.toString());
        // Return Stack Trace to User for Debugging
        res.status(500).json({
            message: "Failed to fetch executive stats",
            error: error.message,
            type: error.name,
            stack: error.stack
        });
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

// --- DUCKDB ANALYTICS (PoC) ---
const getDuckStats = asyncHandler(async (req, res) => {
    const { getAnalytics } = require('../services/duckdbService');
    const stats = await getAnalytics();

    res.json({
        source: 'DuckDB (High-Performance OLAP)',
        message: 'Aggregated analytics from local DuckDB instance',
        data: stats
    });
});

// --- SQLITE CACHE (PoC) ---
const getCacheStats = asyncHandler(async (req, res) => {
    const { set, get, query } = require('../services/sqliteService');
    const { v4: uuidv4 } = require('uuid');

    const key = `cache_test_key`;

    // 1. SET Data (if not exists)
    let cachedData = get(key);
    if (!cachedData) {
        cachedData = {
            id: uuidv4(),
            name: 'Cached Item',
            roles: ['admin', 'manager'],
            meta: { views: 100, likes: 50 },
            timestamp: new Date().toISOString()
        };
        set(key, cachedData, 60); // TTL 60 seconds
    }

    // 2. QUERY Data using JSON Extensions
    // Find items where meta.views > 50
    // Note: 'json_extract' is standard SQLite JSON syntax
    // We are querying the 'cache' table created in initCache
    const sqlQuery = `
        SELECT key, json_extract(value, '$.meta.views') as views 
        FROM cache 
        WHERE json_extract(value, '$.meta.views') > 10;
    `;
    const queryResults = query(sqlQuery);

    res.json({
        source: 'SQLite In-Memory Cache',
        message: 'Data retrieved/set in cache and queried via SQL',
        key_lookup: cachedData,
        sql_query_results: queryResults
    });
});

module.exports = {
    getAdminStats,
    getMarketingStats,
    getAdmissionStats,
    getFinanceStats,
    getExecutiveStats,
    getDuckStats,
    getCacheStats
};
