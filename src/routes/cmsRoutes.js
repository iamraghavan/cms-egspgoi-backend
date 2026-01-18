const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer(); // Memory storage by default

const { authenticate: authMiddleware, roleMiddleware } = require('../middleware/authMiddleware');
const cmsAdmin = require('../controllers/cmsAdminController');
const cmsPublic = require('../controllers/cmsPublicController');

// --- ADMIN API (Protected: Super Admin Only) ---
// Sites
router.post('/admin/sites', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.createSite);
router.get('/admin/sites', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.getSites);
router.put('/admin/sites/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.updateSite);
router.delete('/admin/sites/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.deleteSite);

// Categories
router.post('/admin/categories', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.createCategory);
router.get('/admin/categories', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.getCategories);
router.put('/admin/categories/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.updateCategory);
router.delete('/admin/categories/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.deleteCategory);

// Pages
router.post('/admin/pages', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.createPage);
router.get('/admin/pages', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.getPages);
router.get('/admin/pages/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.getPageById);
router.put('/admin/pages/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.updatePage);
router.delete('/admin/pages/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.deletePage);

// Posts
router.post('/admin/posts', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.createPost);
router.get('/admin/posts', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.getPosts);
router.get('/admin/posts/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.getPostById);
router.put('/admin/posts/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.updatePost);
router.delete('/admin/posts/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.deletePost);

// Ads
router.post('/admin/ads', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.createAd);
router.get('/admin/ads', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.getAds);
router.put('/admin/ads/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.updateAd);
router.delete('/admin/ads/:id', authMiddleware, roleMiddleware('super_admin'), cmsAdmin.deleteAd);

// Assets (GitHub)
// Expects form-data with field name 'file'
router.post('/admin/upload-asset', authMiddleware, roleMiddleware('super_admin'), upload.single('file'), cmsAdmin.uploadAsset);


// --- PUBLIC API (Headless CMS - Read Only) ---
// No Auth Required (Or use API Key logic if desired, but typically public)
router.get('/public/:domain/config', cmsPublic.getSiteConfig);
router.get('/public/:domain/sitemap.xml', cmsPublic.getSitemap); // Actually returns JSON for now, frontend renders XML
router.get('/public/:domain/page/:slug', cmsPublic.getPage);
router.get('/public/:domain/post/:slug', cmsPublic.getPost);
router.get('/public/:domain/posts', cmsPublic.getPosts); // With ?category, ?tag, ?page

module.exports = router;
