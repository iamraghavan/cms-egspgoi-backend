const express = require('express');
const router = express.Router();
const cronController = require('../controllers/cronController');
const logger = require('../utils/logger');

/**
 * Middleware to verify that the request comes from Vercel Crons
 * Uses the Authorization: Bearer <CRON_SECRET> header.
 */
const verifyCronSecret = (req, res, next) => {
    const CRON_SECRET = process.env.CRON_SECRET;
    
    // In local development, if CRON_SECRET is not set, allow access
    if (process.env.NODE_ENV !== 'production' && !CRON_SECRET) {
        return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
        logger.warn('Unauthorized Cron Attempt: Invalid secret');
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    next();
};

// Route: Process Follow-up Notifications
router.post('/notifications', verifyCronSecret, cronController.processNotifications);

// Route: Process CMS Scheduled Publishing
router.post('/cms-publishing', verifyCronSecret, cronController.processCmsPublishing);

module.exports = router;
