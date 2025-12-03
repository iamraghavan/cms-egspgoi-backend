const express = require('express');
const router = express.Router();
const { createLead, getLeads, initiateCall, submitLead } = require('../controllers/leadController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Public/Secure Submission Endpoint
// Mounted at /api/v1, so this becomes /api/v1/leads/submit
router.post('/leads/submit', submitLead);

// Protected Routes
router.post('/leads', authenticate, createLead);
router.get('/leads', authenticate, getLeads);
router.post('/leads/:id/call', authenticate, checkPermission('leads_call'), initiateCall);

module.exports = router;
