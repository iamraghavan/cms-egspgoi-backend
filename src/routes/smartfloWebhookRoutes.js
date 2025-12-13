const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/smartfloWebhookController');

// Smartflo Webhook Endpoint
// Docs: Publicly accessible URL
router.post('/webhook', handleWebhook);

module.exports = router;
