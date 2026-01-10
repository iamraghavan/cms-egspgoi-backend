const express = require('express');
const router = express.Router();
const { hangupCall, getCallRecords, getActiveCall } = require('../controllers/smartfloController');

// Hangup a call
router.post('/call/hangup', hangupCall);

// Get call detail records
router.get('/call/records', getCallRecords);

// Get Active Call Status (Backend Polling)
router.get('/active-call/:lead_id', getActiveCall);

module.exports = router;
