const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadLeads, downloadTemplate } = require('../controllers/bulkLeadController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Configure Multer (Memory Storage)
const storage = multer.memoryStorage();
const upload = multer({ 
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.includes('excel') || file.mimetype.includes('spreadsheet') || file.mimetype.includes('csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel or CSV files are allowed'), false);
        }
    }
});

// Routes
router.post('/upload', authenticate, checkPermission('all'), upload.single('file'), uploadLeads);
router.get('/template', authenticate, downloadTemplate);

module.exports = router;
