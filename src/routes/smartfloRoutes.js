const express = require('express');
const router = express.Router();
const smartfloController = require('../controllers/smartfloController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// All routes require authentication
router.use(authenticate);

// Click to Call (Admission Executive and above)
router.post('/click-to-call', checkPermission('click_to_call'), smartfloController.clickToCall);

// Live Calls (Admission Manager and above)
router.get('/live-calls', checkPermission('view_live_calls'), smartfloController.getLiveCalls);

// Call Records (Admission Executive: own, Manager/Admin: all)
// We'll use a generic permission 'view_call_records' and handle scoping in controller if needed
router.get('/call-records', checkPermission('view_call_records'), smartfloController.getCallRecords);

// Call Operations (Monitor, Whisper, Barge, Transfer) - Manager and above
router.post('/call-operation', checkPermission('manage_active_calls'), smartfloController.callOperation);

// Hangup Call - Manager and above
router.post('/hangup', checkPermission('manage_active_calls'), smartfloController.hangupCall);

// Smartflo Users (Super Admin)
router.get('/users', checkPermission('manage_smartflo_users'), smartfloController.getSmartfloUsers);

module.exports = router;
