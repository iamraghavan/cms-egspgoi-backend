const express = require('express');
const router = express.Router();
const cronController = require('../controllers/cronController');
const logger = require('../utils/logger');

/**
 * Middleware to verify that the request comes from Vercel Crons
 * Supports both Authorization Header and Query Parameter (?key=)
 */
const verifyCronSecret = (req, res, next) => {
    const CRON_SECRET = process.env.CRON_SECRET;
    
    // In local development, if CRON_SECRET is not set, allow access
    if (process.env.NODE_ENV !== 'production' && !CRON_SECRET) {
        return next();
    }

    const authHeader = req.headers.authorization;
    const queryKey = req.query.key;
    
    const isValidHeader = authHeader === `Bearer ${CRON_SECRET}`;
    const isValidQuery = queryKey === CRON_SECRET;

    if (!isValidHeader && !isValidQuery) {
        logger.warn('Unauthorized Cron Attempt: Invalid secret');
        return res.status(401).json({ status: 'error', message: 'Unauthorized' });
    }

    next();
};


// Route: Process Follow-up Notifications (Supports GET/POST)
router.all('/notifications', verifyCronSecret, cronController.processNotifications);

// Route: Process CMS Scheduled Publishing (Supports GET/POST)
router.all('/cms-publishing', verifyCronSecret, cronController.processCmsPublishing);


module.exports = router;
