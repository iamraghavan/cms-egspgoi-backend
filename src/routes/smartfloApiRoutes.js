const express = require('express');
const router = express.Router();
const { hangupCall, getCallRecords, getActiveCall, getLiveCalls } = require('../controllers/smartfloController');

// Hangup a call
router.post('/call/hangup', hangupCall);

// Get call detail records
router.get('/call/records', getCallRecords);

// Get All Live Calls (Super Admin)
router.get('/live-calls', getLiveCalls);

// Get Active Call Status (Backend Polling)
router.get('/active-call/:lead_id', getActiveCall);

// Click to Call (Admission Executive and above)
router.post('/click-to-call', checkPermission('click_to_call'), smartfloController.clickToCall);

module.exports = router;
