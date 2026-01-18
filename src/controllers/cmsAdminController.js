const { v4: uuidv4 } = require('uuid');
const { docClient } = require('../config/db');
const { PutCommand, GetCommand, DeleteCommand, ScanCommand, UpdateCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const {
    CMS_SITES_TABLE, CMS_CATEGORIES_TABLE, CMS_PAGES_TABLE, CMS_POSTS_TABLE, CMS_ADS_TABLE,
    siteSchema, categorySchema, pageSchema, postSchema, adSchema
} = require('../models/cmsModel');
const { uploadToGitHub } = require('../utils/githubUtils');
const Joi = require('joi');
const dns = require('dns').promises; // Native Node.js DNS module

// --- Helper: Scan by Site ID ---
const scanBySite = async (TableName, siteId) => {
    // Note: For production with many items, Query on GSI is better.
    // Here we use Scan with filter for simplicity in initial version, or Query if GSI is available.
    // We defined GSIs in create_cms_tables.js: 'SiteIndex' for Categories, Pages, Posts, Ads.

    if (TableName === CMS_SITES_TABLE) {
        const command = new ScanCommand({ TableName });
        const result = await docClient.send(command);
        return result.Items || [];
    }

    const command = new QueryCommand({
        TableName,
        IndexName: 'SiteIndex',
        KeyConditionExpression: 'site_id = :sid',
        ExpressionAttributeValues: { ':sid': siteId }
    });
    const result = await docClient.send(command);
    return result.Items || [];
};

// --- SITES MANAGEMENT ---

const createSite = async (req, res) => {
    try {
        const id = uuidv4();
        // Generate Token
        const verificationToken = `egsp-ver-${uuidv4().split('-')[0]}-${Date.now()}`;

        const data = {
            ...req.body,
            id,
            created_at: new Date().toISOString(),
            verification: {
                token: verificationToken,
                status: 'pending',
                method: 'dns_txt'
            }
        };

        const { error, value } = siteSchema.validate(data);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_SITES_TABLE, Item: value }));
        res.status(201).json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getSites = async (req, res) => {
    try {
        const command = new ScanCommand({ TableName: CMS_SITES_TABLE });
        const result = await docClient.send(command);
        res.json(result.Items || []);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateSite = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await docClient.send(new GetCommand({ TableName: CMS_SITES_TABLE, Key: { id } }));
        if (!existing.Item) return res.status(404).json({ message: "Site not found" });

        const updated = { ...existing.Item, ...req.body, updated_at: new Date().toISOString() };

        // If domain changed, reset verification
        if (req.body.domain && req.body.domain !== existing.Item.domain) {
            updated.verification = {
                token: `egsp-ver-${uuidv4().split('-')[0]}-${Date.now()}`,
                status: 'pending',
                method: 'dns_txt'
            };
        }

        const { error, value } = siteSchema.validate(updated);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_SITES_TABLE, Item: value }));
        res.json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const verifySiteDNS = async (req, res) => {
    const { id } = req.params;
    try {
        const result = await docClient.send(new GetCommand({ TableName: CMS_SITES_TABLE, Key: { id } }));
        if (!result.Item) return res.status(404).json({ message: "Site not found" });
        const site = result.Item;

        if (!site.verification || !site.verification.token) {
            return res.status(400).json({ message: "No verification token found for this site" });
        }

        const domain = site.domain;
        const expectedToken = site.verification.token;
        console.log(`Verifying DNS for ${domain}. Expecting TXT: ${expectedToken}`);

        let txtRecords = [];
        try {
            txtRecords = await dns.resolveTxt(domain);
            // txtRecords is array of arrays: [ ['value1'], ['value2'] ]
        } catch (dnsErr) {
            console.error("DNS Error:", dnsErr);
            return res.status(400).json({
                message: "DNS Lookup failed",
                error: dnsErr.code,
                instruction: `Please add a TXT record to ${domain} with value: ${expectedToken}`
            });
        }

        // Check if ANY record matches token
        // Flatten the array of arrays
        const flatRecords = txtRecords.flat();
        const isVerified = flatRecords.includes(expectedToken);

        if (isVerified) {
            site.verification.status = 'verified';
            site.verification.verified_at = new Date().toISOString();

            await docClient.send(new PutCommand({ TableName: CMS_SITES_TABLE, Item: site }));
            return res.json({ message: "Site verified successfully!", status: "verified" });
        } else {
            return res.status(400).json({
                message: "Verification failed. Token not found in DNS records.",
                found_records: flatRecords,
                instruction: `Please add a TXT record to ${domain} with value: ${expectedToken}`
            });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteSite = async (req, res) => {
    try {
        await docClient.send(new DeleteCommand({ TableName: CMS_SITES_TABLE, Key: { id: req.params.id } }));
        res.json({ message: "Site deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// --- CATEGORIES MANAGEMENT ---

const createCategory = async (req, res) => {
    try {
        const { error, value } = categorySchema.validate({
            ...req.body,
            id: uuidv4(),
            created_at: new Date().toISOString()
        });
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_CATEGORIES_TABLE, Item: value }));
        res.status(201).json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getCategories = async (req, res) => {
    const { siteId } = req.query; // Required
    if (!siteId) return res.status(400).json({ message: "siteId query param required" });
    try {
        const items = await scanBySite(CMS_CATEGORIES_TABLE, siteId);
        // Build Tree structure? Frontend can do it, but flat list is fine for admin.
        // Let's return flat list sorted by order.
        items.sort((a, b) => (a.order || 0) - (b.order || 0));
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await docClient.send(new GetCommand({ TableName: CMS_CATEGORIES_TABLE, Key: { id } }));
        if (!existing.Item) return res.status(404).json({ message: "Category not found" });

        const updated = { ...existing.Item, ...req.body, updated_at: new Date().toISOString() };
        const { error, value } = categorySchema.validate(updated);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_CATEGORIES_TABLE, Item: value }));
        res.json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteCategory = async (req, res) => {
    try {
        await docClient.send(new DeleteCommand({ TableName: CMS_CATEGORIES_TABLE, Key: { id: req.params.id } }));
        res.json({ message: "Category deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// --- ASSET UPLOAD (GitHub) ---
const uploadAsset = async (req, res) => {
    try {
        // Expect multipart/form-data handled by multer or busboy?
        // Wait, I need middleware for file upload. I verified 'multer' is not in package.json from previous context?
        // If no multer, I have to handle raw stream or install multer.
        // Assuming user setup usually implies 'multer' or similar.
        // Use 'multer' memory storage.

        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const url = await uploadToGitHub(req.file.buffer, req.file.originalname, req.file.mimetype);
        res.json({ url, name: req.file.originalname, type: req.file.mimetype });
    } catch (err) {
        console.error("Upload Error:", err);
        res.status(500).json({ message: "Asset upload failed", error: err.message });
    }
};


// --- PAGES MANAGEMENT ---

const createPage = async (req, res) => {
    try {
        // Auto-generate slug if missing
        if (!req.body.slug && req.body.title) {
            req.body.slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        const { error, value } = pageSchema.validate({
            ...req.body,
            id: uuidv4(),
            created_at: new Date().toISOString()
        });
        if (error) return res.status(400).json({ error: error.details[0].message });

        // Check Unique Slug in Site
        // TODO: Optimization - Perform Query check

        await docClient.send(new PutCommand({ TableName: CMS_PAGES_TABLE, Item: value }));
        res.status(201).json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPages = async (req, res) => {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ message: "siteId required" });
    try {
        const items = await scanBySite(CMS_PAGES_TABLE, siteId);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPageById = async (req, res) => {
    try {
        const result = await docClient.send(new GetCommand({ TableName: CMS_PAGES_TABLE, Key: { id: req.params.id } }));
        if (!result.Item) return res.status(404).json({ message: "Page not found" });
        res.json(result.Item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updatePage = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await docClient.send(new GetCommand({ TableName: CMS_PAGES_TABLE, Key: { id } }));
        if (!existing.Item) return res.status(404).json({ message: "Page not found" });

        const updated = { ...existing.Item, ...req.body, updated_at: new Date().toISOString() };
        const { error, value } = pageSchema.validate(updated);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_PAGES_TABLE, Item: value }));
        res.json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deletePage = async (req, res) => {
    try {
        await docClient.send(new DeleteCommand({ TableName: CMS_PAGES_TABLE, Key: { id: req.params.id } }));
        res.json({ message: "Page deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// --- POSTS MANAGEMENT (Blogs/Articles/Videos) ---

const createPost = async (req, res) => {
    try {
        // Auto-generate slug if missing
        if (!req.body.slug && req.body.title) {
            req.body.slug = req.body.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        const data = {
            ...req.body,
            id: uuidv4(),
            created_at: new Date().toISOString(),
            author_id: req.user.id // From Auth Middleware
        };

        // If publishing now
        if (data.status === 'published' && !data.published_at) {
            data.published_at = new Date().toISOString();
        }

        const { error, value } = postSchema.validate(data);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_POSTS_TABLE, Item: value }));
        res.status(201).json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPosts = async (req, res) => {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ message: "siteId required" });
    try {
        const items = await scanBySite(CMS_POSTS_TABLE, siteId);
        // Sort by published_at desc
        items.sort((a, b) => new Date(b.published_at || 0) - new Date(a.published_at || 0));
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getPostById = async (req, res) => {
    try {
        const result = await docClient.send(new GetCommand({ TableName: CMS_POSTS_TABLE, Key: { id: req.params.id } }));
        if (!result.Item) return res.status(404).json({ message: "Post not found" });
        res.json(result.Item);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updatePost = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await docClient.send(new GetCommand({ TableName: CMS_POSTS_TABLE, Key: { id } }));
        if (!existing.Item) return res.status(404).json({ message: "Post not found" });

        const updated = { ...existing.Item, ...req.body, updated_at: new Date().toISOString() };

        // Update published_at if status changed to published
        if (updated.status === 'published' && !existing.Item.published_at) {
            updated.published_at = new Date().toISOString();
        }

        const { error, value } = postSchema.validate(updated);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_POSTS_TABLE, Item: value }));
        res.json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deletePost = async (req, res) => {
    try {
        await docClient.send(new DeleteCommand({ TableName: CMS_POSTS_TABLE, Key: { id: req.params.id } }));
        res.json({ message: "Post deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// --- ADS MANAGEMENT ---

const createAd = async (req, res) => {
    try {
        const { error, value } = adSchema.validate({
            ...req.body,
            id: uuidv4(),
            created_at: new Date().toISOString()
        });
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_ADS_TABLE, Item: value }));
        res.status(201).json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getAds = async (req, res) => {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ message: "siteId required" });
    try {
        const items = await scanBySite(CMS_ADS_TABLE, siteId);
        res.json(items);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateAd = async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await docClient.send(new GetCommand({ TableName: CMS_ADS_TABLE, Key: { id } }));
        if (!existing.Item) return res.status(404).json({ message: "Ad not found" });

        const updated = { ...existing.Item, ...req.body, updated_at: new Date().toISOString() };
        const { error, value } = adSchema.validate(updated);
        if (error) return res.status(400).json({ error: error.details[0].message });

        await docClient.send(new PutCommand({ TableName: CMS_ADS_TABLE, Item: value }));
        res.json(value);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteAd = async (req, res) => {
    try {
        await docClient.send(new DeleteCommand({ TableName: CMS_ADS_TABLE, Key: { id: req.params.id } }));
        res.json({ message: "Ad deleted" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createSite, getSites, updateSite, deleteSite, verifySiteDNS,
    createCategory, getCategories, updateCategory, deleteCategory,
    createPage, getPages, getPageById, updatePage, deletePage,
    createPost, getPosts, getPostById, updatePost, deletePost,
    createAd, getAds, updateAd, deleteAd,
    uploadAsset
};
