const express = require('express');
const router = express.Router();
const {
    getAdminStats,
    getMarketingStats,
    getAdmissionStats,
    getFinanceStats,
    getExecutiveStats
} = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// DuckDB High-Performance Analytics (PoC)
const { getDuckStats, getCacheStats } = require('../controllers/analyticsController');

// SQLite Cache Test (PoC) - Public Exception
router.get('/cache-test', getCacheStats);

router.use(authenticate);

// Super Admin
router.get('/admin', checkPermission('all'), getAdminStats);

// Marketing Manager
router.get('/marketing', checkPermission('campaigns'), getMarketingStats);

// Admission Manager
router.get('/admission', checkPermission('leads_manage'), getAdmissionStats);

// Finance
router.get('/finance', checkPermission('budgets_approve'), getFinanceStats);

// Admission Executive (and Manager)
// We need a permission that executives have. 'leads_call' is a good proxy.
router.get('/executive', checkPermission('leads_call'), getExecutiveStats);

// DuckDB High-Performance Analytics (PoC) - Protected
router.get('/duck', checkPermission('all'), getDuckStats);

module.exports = router;
