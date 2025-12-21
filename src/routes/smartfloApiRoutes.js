const express = require('express');
const router = express.Router();
const { hangupCall, getCallRecords } = require('../controllers/smartfloController');

// Hangup a call
router.post('/call/hangup', hangupCall);

// Get call detail records
router.get('/call/records', getCallRecords);

module.exports = router;
