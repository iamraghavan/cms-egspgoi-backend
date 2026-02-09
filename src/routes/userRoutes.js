const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { checkPermission } = require('../middleware/rbacMiddleware');

// Public routes
router.post('/register', userController.register); // In a real app, registration might be restricted
const { validateTurnstile } = require('../middleware/turnstileMiddleware');
router.post('/login', validateTurnstile, userController.login);
router.post('/refresh', userController.refreshToken);

const { cacheMiddleware } = require('../middleware/cacheMiddleware');

// Profile Management
router.get('/users/profile', authenticate, userController.getProfile); // Get Own Profile
router.patch('/users/profile', authenticate, userController.updateProfile); // Update Own Profile
router.post('/users/device-token', authenticate, userController.updateDeviceToken);
router.post('/pusher/auth', authenticate, userController.pusherAuth);

// User Management (Admin/Manager)
router.post('/auth/refresh', userController.refreshToken);
router.patch('/auth/availability', authenticate, userController.toggleAvailability);
router.put('/auth/settings', authenticate, require('../controllers/userSettingsController').updateSettings);
router.get('/', authenticate, userController.getUsers); // Authenticated users can get list
router.post('/', authenticate, checkPermission('all'), userController.createUser); // Only Super Admin
router.get('/:id', authenticate, userController.getUserById); // Get User Details
router.put('/:id', authenticate, checkPermission('all'), userController.updateUser); // Only Super Admin
router.delete('/:id', authenticate, checkPermission('all'), userController.deleteUser); // Only Super Admin

module.exports = router;
