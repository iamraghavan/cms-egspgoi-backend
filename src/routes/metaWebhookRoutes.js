const express = require('express');
const router = express.Router();
const { verifyWebhook, handleMetaLead, handleGoogleSheetLead } = require('../controllers/metaWebhookController');

// GET - Verification for Meta (Facebook)
router.get('/webhook', verifyWebhook);

// POST - Receive Leads from Meta (Facebook)
router.post('/webhook', handleMetaLead);

// POST - Receive Leads from Google Sheets
router.post('/sheets', handleGoogleSheetLead);

module.exports = router;

