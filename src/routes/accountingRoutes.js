const express = require('express');
const router = express.Router();
const { createPaymentRecord, getPaymentRecords, createAdSpend, getAdSpends } = require('../controllers/accountingController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

router.use(authenticate);

// Payment Records (Finance)
router.post('/accounting/payments', checkPermission('proofs_verify'), createPaymentRecord); // Reusing finance permission
router.get('/accounting/payments', checkPermission('proofs_verify'), getPaymentRecords);

// Ad Spends (Marketing Manager)
router.post('/accounting/ad-spends', checkPermission('budgets'), createAdSpend); // Reusing marketing permission
router.get('/accounting/ad-spends', checkPermission('budgets'), getAdSpends);

module.exports = router;
