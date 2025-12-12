const express = require('express');
const router = express.Router();
const { createLead, getLeads, initiateCall, submitLead, addNote, transferLead, updateLeadStatus } = require('../controllers/leadController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Public/Secure Submission Endpoint
// Mounted at /api/v1, so this becomes /api/v1/leads/submit
router.post('/leads/submit', submitLead);

// Protected Routes
router.post('/leads', authenticate, createLead);
router.get('/leads', authenticate, getLeads);
// Call: Admission Exec, Manager, or Super Admin (handled in controller or via multiple permissions)
// For now, we'll check 'leads_call' OR 'all' (Super Admin)
// Since checkPermission takes one, we might need a custom middleware or just add 'leads_call' to Super Admin permissions in seed.
// Alternatively, we can use a custom check here.
router.post('/leads/:id/call', authenticate, (req, res, next) => {
    if (req.user.role === 'Super Admin' || req.user.role === 'Admission Manager' || req.user.role === 'Admission Executive') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied' });
    }
}, initiateCall);

router.post('/leads/:id/notes', authenticate, addNote); // Any auth user can add note? Or restricted?
router.post('/leads/:id/transfer', authenticate, (req, res, next) => {
     if (req.user.role === 'Super Admin' || req.user.role === 'Admission Manager') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Only Admins/Managers can transfer leads' });
    }
}, transferLead);

router.patch('/leads/:id/status', authenticate, updateLeadStatus);

module.exports = router;
