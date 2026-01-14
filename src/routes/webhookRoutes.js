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

// 1. Smartflo Webhook
// Endpoint: /api/v1/webhook/smartflo
router.post('/smartflo', verifySecret, handleWebhook);

module.exports = router;
