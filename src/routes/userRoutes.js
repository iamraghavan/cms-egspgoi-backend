const express = require('express');
const router = express.Router();
const { register, login, getProfile, getUsers, createUser, refreshToken, toggleAvailability, updateUser, deleteUser } = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Public routes
router.post('/register', register); // In a real app, registration might be restricted
router.post('/login', login);
router.post('/refresh', refreshToken);

// Protected routes
router.get('/auth/profile', authenticate, getProfile); // Get Own Profile
router.patch('/auth/profile', authenticate, require('../controllers/userController').updateProfile); // Update Own Profile
router.post('/auth/refresh', refreshToken);
router.patch('/auth/availability', authenticate, toggleAvailability);
router.put('/auth/settings', authenticate, require('../controllers/userSettingsController').updateSettings);
router.get('/', authenticate, getUsers); // Authenticated users can get list
router.post('/', authenticate, checkPermission('all'), createUser); // Only Super Admin
router.get('/:id', authenticate, require('../controllers/userController').getUserById); // Get User Details
router.put('/:id', authenticate, checkPermission('all'), updateUser); // Only Super Admin
router.delete('/:id', authenticate, checkPermission('all'), deleteUser); // Only Super Admin

module.exports = router;
