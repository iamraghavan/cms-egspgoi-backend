const express = require('express');
const router = express.Router();
const { hangupCall, getCallRecords, getActiveCall, getLiveCalls, clickToCall } = require('../controllers/smartfloController');
const { checkPermission } = require('../middleware/rbacMiddleware');
const { authenticate } = require('../middleware/authMiddleware');

// Hangup a call
router.post('/call/hangup', hangupCall);

// Get call detail records
router.get('/call/records', getCallRecords);

// Get All Live Calls (Super Admin)
router.get('/live-calls', authenticate, getLiveCalls);

// Get Active Call Status (Backend Polling)
router.get('/active-call/:lead_id', authenticate, getActiveCall);

// Click to Call (Admission Executive and above)
router.post('/click-to-call', authenticate, checkPermission('click_to_call'), clickToCall);

module.exports = router;
