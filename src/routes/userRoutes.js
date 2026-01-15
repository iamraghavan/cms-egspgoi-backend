const express = require('express');
const router = express.Router();
const { register, login, getProfile, getUsers, createUser, refreshToken, toggleAvailability, updateUser, deleteUser } = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Public routes
router.post('/register', register); // In a real app, registration might be restricted
router.post('/register', userController.register); // In a real app, registration might be restricted
const { validateTurnstile } = require('../middleware/turnstileMiddleware');
router.post('/login', validateTurnstile, userController.login);
router.post('/refresh', userController.refreshToken);

const { cacheMiddleware } = require('../middleware/cacheMiddleware');

// Profile Management
router.get('/users/profile', authenticate, userController.getProfile); // Get Own Profile
router.patch('/users/profile', authenticate, userController.updateProfile); // Update Own Profile
router.post('/users/device-token', authenticate, userController.updateDeviceToken);

// User Management (Admin/Manager)
router.post('/auth/refresh', userController.refreshToken); // This seems like a duplicate of the public one, consider removing or clarifying
router.patch('/auth/availability', authenticate, userController.toggleAvailability);
router.put('/auth/settings', authenticate, require('../controllers/userSettingsController').updateSettings);
router.put('/:id', authenticate, checkPermission('all'), updateUser); // Only Super Admin
router.delete('/:id', authenticate, checkPermission('all'), deleteUser); // Only Super Admin

module.exports = router;
