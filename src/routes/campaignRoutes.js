const express = require('express');
const router = express.Router();
const { createCampaign, getCampaigns, getCampaignById, updateCampaign, updateCampaignStatus, deleteCampaign } = require('../controllers/campaignController');
const { createBudget, approveBudget, uploadProof, verifyProof, deleteBudget } = require('../controllers/budgetController');
const { uploadAsset, getAssets, updateAssetStatus, deleteAsset } = require('../controllers/assetController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Campaigns
router.post('/campaigns', authenticate, checkPermission('campaigns'), createCampaign);
router.get('/campaigns', authenticate, getCampaigns);
router.get('/campaigns/:id', authenticate, getCampaignById);
router.put('/campaigns/:id', authenticate, checkPermission('campaigns'), updateCampaign);
router.delete('/campaigns/:id', authenticate, checkPermission('campaigns_delete'), deleteCampaign);
// Note: 'campaigns_delete' permission might need to be seeded or we just use 'campaigns' if we want simpler RBAC
// For now let's assume 'campaigns' covers editing, but deletion might be restricted.
// User requirement: Marketing Manager (Full Access). Super Admin (Full Access).
router.patch('/campaigns/:id/status', authenticate, checkPermission('campaigns'), updateCampaignStatus);

// Budgets
router.post('/budgets', authenticate, checkPermission('budgets'), createBudget);
router.patch('/budgets/:id/approve', authenticate, checkPermission('budgets_approve'), approveBudget);
router.delete('/budgets/:id', authenticate, checkPermission('budgets_delete'), deleteBudget);

// Proofs
router.post('/proofs', authenticate, uploadProof); // Any auth user can upload? Or restricted? Assuming Marketing/Finance
router.patch('/proofs/:id/verify', authenticate, checkPermission('proofs_verify'), verifyProof);

// Assets
router.post('/assets', authenticate, checkPermission('assets_upload'), uploadAsset);
router.get('/assets', authenticate, getAssets);
router.patch('/assets/:id/status', authenticate, checkPermission('campaigns'), updateAssetStatus); // Marketing Manager approves assets
router.delete('/assets/:id', authenticate, checkPermission('assets_delete'), deleteAsset);

module.exports = router;
