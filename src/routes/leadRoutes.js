const express = require('express');
const router = express.Router();
const { createLead, getLeads, initiateCall, submitLead, addNote, getLeadNotes, transferLead, updateLeadStatus, deleteLead, headLead, optionsLead, putLead, bulkTransferLeads, getLead } = require('../controllers/leadController');
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

router.post('/leads/:id/notes', authenticate, addNote);
router.get('/leads/:id/notes', authenticate, getLeadNotes);
router.post('/leads/:id/transfer', authenticate, (req, res, next) => {
    if (req.user.role === 'Super Admin' || req.user.role === 'Admission Manager') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Only Admins/Managers can transfer leads' });
    }
}, transferLead);

router.post('/leads/bulk-transfer', authenticate, (req, res, next) => {
    if (req.user.role === 'Super Admin' || req.user.role === 'Admission Manager') {
        next();
    } else {
        res.status(403).json({ message: 'Access denied: Only Admins/Managers can bulk transfer' });
    }
}, bulkTransferLeads);

router.patch('/leads/:id/status', authenticate, updateLeadStatus);

// Standardized Methods
router.get('/leads/:id', authenticate, getLead);
router.delete('/leads/:id', authenticate, deleteLead);
router.head('/leads/:id', authenticate, headLead);
router.options('/leads', optionsLead);
router.put('/leads/:id', authenticate, putLead);

router.post('/leads/calls/hangup', require('../controllers/smartfloController').hangupCall);
router.get('/leads/calls/records', require('../controllers/smartfloController').getCallRecords);

module.exports = router;
