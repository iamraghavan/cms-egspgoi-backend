const express = require('express');
const router = express.Router();
const { verifyWebhook, handleMetaLead } = require('../controllers/metaWebhookController');

// GET - Verification for Meta (Facebook)
router.get('/webhook', verifyWebhook);

// POST - Receive Leads from Meta (Facebook)
router.post('/webhook', handleMetaLead);

module.exports = router;
