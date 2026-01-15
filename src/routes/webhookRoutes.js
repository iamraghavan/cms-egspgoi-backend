const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/smartfloWebhookController');

// Custom Security Middleware
const verifySecret = (req, res, next) => {
    // User requested custom header check. 
    // Header Name: x-webhook-secret
    // Value: 232003
    const secret = req.headers['x-webhook-secret'];
    if (secret !== '232003') {
        return res.status(403).json({ message: 'Forbidden: Invalid Webhook Secret' });
    }
    next();
};

// 1. Smartflo Webhooks
// Unified endpoint (Legacy support removed)
// router.post('/smartflo', verifySecret, handleWebhook);

// 2. Specific Triggers (New Architecture)
router.post('/smartflo/agent/answered', verifySecret, handleWebhook);
router.post('/smartflo/customer/answered', verifySecret, handleWebhook);
router.post('/smartflo/call/completed', verifySecret, handleWebhook);

module.exports = router;
