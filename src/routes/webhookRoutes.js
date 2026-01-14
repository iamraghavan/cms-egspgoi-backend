const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/smartfloWebhookController');

// 1. Smartflo Webhook
// Endpoint: /api/v1/webhook/smartflo
router.post('/smartflo', handleWebhook);

module.exports = router;
