const express = require('express');
const router = express.Router();
const { generateBlog } = require('../controllers/geminiController');

// Simple API Key Middleware
const checkApiKey = (req, res, next) => {
    const { key } = req.query;
    if (key === '232003') {
        return next();
    }
    return res.status(401).json({ message: 'Unauthorized: Invalid API Key found' });
};

router.post('/generate', generateBlog);

module.exports = router;
