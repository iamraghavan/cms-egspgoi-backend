const { docClient } = require('../config/db');
const { ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const {
    CMS_SITES_TABLE, CMS_CATEGORIES_TABLE, CMS_PAGES_TABLE, CMS_POSTS_TABLE, CMS_ADS_TABLE
} = require('../models/cmsModel');

// --- Helper: Get Site ID by Domain or ID ---
const resolveSiteId = async (identifier) => {
    // If identifier is UUID-like, assume ID. Else domain.
    // Optimization: Cache this mapping in memory or Redis.
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier);
    if (isUuid) return identifier;

    // Scan for domain (Slow, but Sites table is small)
    // In prod, GSI on 'domain' is improved.
    const command = new ScanCommand({
        TableName: CMS_SITES_TABLE,
        FilterExpression: "#d = :domain",
        ExpressionAttributeNames: { "#d": "domain" },
        ExpressionAttributeValues: { ":domain": identifier }
    });
    const result = await docClient.send(command);
    if (result.Items && result.Items.length > 0) return result.Items[0].id;
    return null;
};

// --- CONTROLLERS ---

const getSiteConfig = async (req, res) => {
    try {
        const { domain } = req.params;
        const siteId = await resolveSiteId(domain);
        if (!siteId) return res.status(404).json({ message: "Site not found" });

        // 1. Site Info
        // 2. Categories
        // 3. Header Pages (Navigation)
        // 4. Footer Pages (Navigation)
        // 5. Ad Codes (Global)

        const [siteRes, catRes, pageRes, adRes] = await Promise.all([
            docClient.send(new QueryCommand({
                TableName: CMS_SITES_TABLE,
                KeyConditionExpression: "id = :id",
                ExpressionAttributeValues: { ":id": siteId }
            })),
            docClient.send(new QueryCommand({
                TableName: CMS_CATEGORIES_TABLE,
                IndexName: 'SiteIndex',
                KeyConditionExpression: 'site_id = :sid',
                ExpressionAttributeValues: { ':sid': siteId }
            })),
            docClient.send(new QueryCommand({
                TableName: CMS_PAGES_TABLE,
                IndexName: 'SiteIndex',
                KeyConditionExpression: 'site_id = :sid',
                ExpressionAttributeValues: { ':sid': siteId }
            })),
            docClient.send(new QueryCommand({
                TableName: CMS_ADS_TABLE,
                IndexName: 'SiteIndex',
                KeyConditionExpression: 'site_id = :sid',
                ExpressionAttributeValues: { ':sid': siteId }
            }))
        ]);

        const site = siteRes.Items[0];
        const categories = (catRes.Items || []).sort((a, b) => a.order - b.order);
        const pages = (pageRes.Items || []).filter(p => p.status === 'published' && p.visibility?.show);
        const ads = (adRes.Items || []).filter(a => a.status === 'active');

        res.json({
            site: {
                name: site.name,
                domain: site.domain,
                settings: site.settings,
                seo_global: site.seo_global,
                scripts: site.scripts
            },
            navigation: {
                categories: categories.filter(c => c.show_on_menu),
                header_pages: pages.filter(p => ['header', 'both'].includes(p.location)).sort((a, b) => a.order - b.order),
                footer_pages: pages.filter(p => ['footer', 'both'].includes(p.location)).sort((a, b) => a.order - b.order)
            },
            ads: ads.reduce((acc, ad) => { acc[ad.space_key] = ad; return acc; }, {})
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Failed to fetch site config" });
    }
};

const getPage = async (req, res) => {
    try {
        const { domain, slug } = req.params;
        const siteId = await resolveSiteId(domain);
        if (!siteId) return res.status(404).json({ message: "Site not found" });

        // Query by Site + Slug (Composite GSI)
        const command = new QueryCommand({
            TableName: CMS_PAGES_TABLE,
            IndexName: "SiteIndex",
            KeyConditionExpression: "site_id = :sid AND slug = :slug",
            ExpressionAttributeValues: { ":sid": siteId, ":slug": slug }
        });

        const result = await docClient.send(command);
        if (!result.Items || result.Items.length === 0) {
            return res.status(404).json({ message: "Page not found" });
        }

        const page = result.Items[0];
        if (page.status !== 'published') return res.status(404).json({ message: "Page not found" });

        res.json(page);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPost = async (req, res) => {
    try {
        const { domain, slug } = req.params;
        const siteId = await resolveSiteId(domain);
        if (!siteId) return res.status(404).json({ message: "Site not found" });

        // Problem: Posts don't have Slug in SortKey (published_at is SortKey).
        // Solution: Scan with Filter OR Add GSI for Slug.
        // For now, Scan with Filter (Acceptable for MVP, but optimization needed later).
        // Actually, earlier design said SortKey: published_at.
        // Let's add GSI for Slug ASAP or simple Scan for now.

        const command = new ScanCommand({
            TableName: CMS_POSTS_TABLE,
            FilterExpression: "site_id = :sid AND slug = :slug",
            ExpressionAttributeValues: { ":sid": siteId, ":slug": slug }
        });

        const result = await docClient.send(command);
        if (!result.Items || result.Items.length === 0) {
            return res.status(404).json({ message: "Post not found" });
        }

        const post = result.Items[0];
        if (post.status !== 'published') return res.status(404).json({ message: "Post not found" });

        res.json(post);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPosts = async (req, res) => {
    try {
        const { domain } = req.params;
        const { category, tag, search, page = 1, limit = 10 } = req.query;

        const siteId = await resolveSiteId(domain);
        if (!siteId) return res.status(404).json({ message: "Site not found" });

        // Fetch All for Site (Sorted by Date)
        const command = new QueryCommand({
            TableName: CMS_POSTS_TABLE,
            IndexName: "SiteIndex",
            KeyConditionExpression: "site_id = :sid",
            ExpressionAttributeValues: { ":sid": siteId },
            ScanIndexForward: false // Descending order (Newest first)
        });

        const result = await docClient.send(command);
        let items = result.Items || [];

        // Filter Published
        items = items.filter(p => p.status === 'published');

        // Apply Filters (Memory Filter for MVP)
        if (category) items = items.filter(p => p.category_id === category || p.subcategory_id === category);
        if (tag) items = items.filter(p => p.tags && p.tags.includes(tag));
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(p => p.title.toLowerCase().includes(q) || p.summary?.toLowerCase().includes(q));
        }

        // Pagination
        const total = items.length;
        const startIndex = (page - 1) * limit;
        const sliced = items.slice(startIndex, startIndex + parseInt(limit));

        res.json({
            data: sliced,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getSitemap = async (req, res) => {
    try {
        const { domain } = req.params;
        const siteId = await resolveSiteId(domain);
        if (!siteId) return res.status(404).json({ message: "Site not found" });

        const [pageRes, postRes] = await Promise.all([
            docClient.send(new QueryCommand({
                TableName: CMS_PAGES_TABLE,
                IndexName: 'SiteIndex',
                KeyConditionExpression: 'site_id = :sid',
                ExpressionAttributeValues: { ':sid': siteId }
            })),
            docClient.send(new QueryCommand({
                TableName: CMS_POSTS_TABLE,
                IndexName: 'SiteIndex',
                KeyConditionExpression: 'site_id = :sid',
                ExpressionAttributeValues: { ':sid': siteId }
            }))
        ]);

        const pages = (pageRes.Items || []).filter(p => p.status === 'published').map(p => ({
            loc: `https://${domain}/${p.slug}`,
            lastmod: p.updated_at || p.created_at,
            changefreq: 'weekly',
            priority: 0.8
        }));

        const posts = (postRes.Items || []).filter(p => p.status === 'published').map(p => ({
            loc: `https://${domain}/post/${p.slug}`,
            lastmod: p.updated_at || p.published_at,
            changefreq: 'monthly',
            priority: 0.6
        }));

        res.json([...pages, ...posts]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    getSiteConfig,
    getPage,
    getPost,
    getPosts,
    getSitemap
};
