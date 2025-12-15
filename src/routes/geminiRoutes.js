const express = require('express');
const router = express.Router();
const { generateBlog } = require('../controllers/geminiController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/generate', authenticate, generateBlog);

module.exports = router;
