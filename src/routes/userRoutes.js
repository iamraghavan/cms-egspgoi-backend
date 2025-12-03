const express = require('express');
const router = express.Router();
const { register, login, getProfile, getAllUsers, createUser, refreshToken } = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Public routes
router.post('/register', register); // In a real app, registration might be restricted
router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.get('/', authenticate, checkPermission('all'), getAllUsers); // Only Super Admin (with 'all' permission)
router.post('/', authenticate, checkPermission('all'), createUser); // Only Super Admin

module.exports = router;
