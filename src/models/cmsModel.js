const Joi = require('joi');

const CMS_SITES_TABLE = "CMS_Sites";
const CMS_CATEGORIES_TABLE = "CMS_Categories";
const CMS_PAGES_TABLE = "CMS_Pages";
const CMS_POSTS_TABLE = "CMS_Posts";
const CMS_ADS_TABLE = "CMS_Ads";

// 1. Site Schema
const siteSchema = Joi.object({
    id: Joi.string().required(), // PK: SITE#uuid or domain
    name: Joi.string().required(),
    domain: Joi.string().domain().required(),
    api_key: Joi.string().required(), // For read-only access
    settings: Joi.object({
        logo: Joi.string().uri().allow(null, ''),
        favicon: Joi.string().uri().allow(null, ''),
        theme_color: Joi.string().pattern(/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/).allow(null),
        social_links: Joi.object().pattern(Joi.string(), Joi.string().uri())
    }).default({}),
    seo_global: Joi.object({
        title_suffix: Joi.string().allow(''),
        default_image: Joi.string().uri().allow(''),
        twitter_handle: Joi.string().allow('')
    }).default({}),
    cache_config: Joi.object({
        enabled: Joi.boolean().default(true),
        refresh_time_min: Joi.number().default(10)
    }).default({}),
    rss_feed: Joi.boolean().default(true),
    scripts: Joi.object({
        google_analytics: Joi.string().allow(''),
        gtm_id: Joi.string().allow(''),
        pixels: Joi.string().allow('')
    }).default({}),
    created_at: Joi.string(),
    updated_at: Joi.string()
});

// 2. Category Schema
const categorySchema = Joi.object({
    id: Joi.string().required(), // PK: CAT#uuid
    site_id: Joi.string().required(), // GSI PK
    name: Joi.string().required(),
    slug: Joi.string().required(), // Unique per site
    language: Joi.string().default('en'),
    parent_id: Joi.string().allow(null), // For Subcategories
    order: Joi.number().default(1),
    show_on_menu: Joi.boolean().default(true),
    seo: Joi.object({
        description: Joi.string().allow(''),
        keywords: Joi.string().allow('')
    }).default({}),
    created_at: Joi.string(),
    updated_at: Joi.string()
});

// 3. Page Schema
const pageSchema = Joi.object({
    id: Joi.string().required(), // PK: PAGE#uuid
    site_id: Joi.string().required(), // GSI PK
    title: Joi.string().required(),
    slug: Joi.string().required(),
    language: Joi.string().default('en'),
    content: Joi.string().allow(''), // HTML from TinyMCE
    parent_id: Joi.string().allow(null),
    order: Joi.number().default(1),
    location: Joi.string().valid('header', 'footer', 'both', 'none').default('header'),
    visibility: Joi.object({
        show: Joi.boolean().default(true),
        registered_only: Joi.boolean().default(false)
    }).default({}),
    layout: Joi.object({
        show_title: Joi.boolean().default(true),
        show_breadcrumb: Joi.boolean().default(true),
        show_right_column: Joi.boolean().default(true)
    }).default({}),
    seo: Joi.object({
        meta_title: Joi.string().allow(''),
        meta_description: Joi.string().allow(''),
        keywords: Joi.string().allow(''),
        canonical_url: Joi.string().uri().allow(''),
        og_image: Joi.string().uri().allow(''),
        noindex: Joi.boolean().default(false)
    }).default({}),
    status: Joi.string().valid('published', 'draft').default('draft'),
    created_at: Joi.string(),
    updated_at: Joi.string()
});

// 4. Post Schema
const postSchema = Joi.object({
    id: Joi.string().required(), // PK: POST#uuid
    site_id: Joi.string().required(), // GSI PK
    title: Joi.string().required(),
    slug: Joi.string().required(), // Unique per site
    language: Joi.string().default('en'),
    summary: Joi.string().allow(''),
    content: Joi.string().allow(''), // TinyMCE
    category_id: Joi.string().allow(null),
    subcategory_id: Joi.string().allow(null),
    tags: Joi.array().items(Joi.string()).default([]),

    // Flags
    add_to_slider: Joi.boolean().default(false),
    add_to_our_picks: Joi.boolean().default(false),
    registered_only: Joi.boolean().default(false),

    // Media & Files
    main_image: Joi.string().uri().allow(null, ''),
    additional_images: Joi.array().items(Joi.string().uri()).default([]),
    files: Joi.array().items(Joi.object({
        name: Joi.string(),
        url: Joi.string().uri(),
        type: Joi.string()
    })).default([]),

    // Video
    video: Joi.object({
        url: Joi.string().uri().allow(''), // Youtube, Vimeo etc
        embed_code: Joi.string().allow(''),
        thumbnail: Joi.string().uri().allow('')
    }).default({}),

    optional_url: Joi.string().uri().allow(''),

    seo: Joi.object({
        meta_title: Joi.string().allow(''),
        meta_description: Joi.string().allow(''),
        keywords: Joi.string().allow(''),
        canonical_url: Joi.string().uri().allow(''),
        og_image: Joi.string().uri().allow(''),
        noindex: Joi.boolean().default(false)
    }).default({}),

    status: Joi.string().valid('published', 'draft').default('draft'),
    published_at: Joi.string().isoDate().allow(null),
    author_id: Joi.string().required(),
    created_at: Joi.string(),
    updated_at: Joi.string()
});

// 5. Ad Schema
const adSchema = Joi.object({
    id: Joi.string().required(), // PK: AD#uuid
    site_id: Joi.string().required(), // GSI PK
    space_key: Joi.string().valid('index_top', 'sidebar_300', 'banner_728', 'banner_468', 'banner_234', 'custom').required(),
    type: Joi.string().valid('code', 'image').default('code'),
    code: Joi.string().allow(''), // HTML/JS
    image_url: Joi.string().uri().allow(''),
    target_url: Joi.string().uri().allow(''),
    status: Joi.string().valid('active', 'inactive').default('active'),
    created_at: Joi.string(),
    updated_at: Joi.string()
});

module.exports = {
    CMS_SITES_TABLE,
    CMS_CATEGORIES_TABLE,
    CMS_PAGES_TABLE,
    CMS_POSTS_TABLE,
    CMS_ADS_TABLE,
    siteSchema,
    categorySchema,
    pageSchema,
    postSchema,
    adSchema
};
