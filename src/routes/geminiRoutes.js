const express = require('express');
const router = express.Router();
const { generateBlog } = require('../controllers/geminiController');

router.post('/generate', generateBlog);

module.exports = router;
