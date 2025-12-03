const express = require('express');
const router = express.Router();
const { createCampaign, getCampaigns, updateCampaignStatus } = require('../controllers/campaignController');
const { createBudget, approveBudget, uploadProof, verifyProof } = require('../controllers/budgetController');
const { uploadAsset, getAssets, updateAssetStatus } = require('../controllers/assetController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Campaigns
router.post('/campaigns', authenticate, checkPermission('campaigns'), createCampaign);
router.get('/campaigns', authenticate, getCampaigns);
router.patch('/campaigns/:id/status', authenticate, checkPermission('campaigns'), updateCampaignStatus);

// Budgets
router.post('/budgets', authenticate, checkPermission('budgets'), createBudget);
router.patch('/budgets/:id/approve', authenticate, checkPermission('budgets_approve'), approveBudget);

// Proofs
router.post('/proofs', authenticate, uploadProof); // Any auth user can upload? Or restricted? Assuming Marketing/Finance
router.patch('/proofs/:id/verify', authenticate, checkPermission('proofs_verify'), verifyProof);

// Assets
router.post('/assets', authenticate, checkPermission('assets_upload'), uploadAsset);
router.get('/assets', authenticate, getAssets);
router.patch('/assets/:id/status', authenticate, checkPermission('campaigns'), updateAssetStatus); // Marketing Manager approves assets

module.exports = router;
