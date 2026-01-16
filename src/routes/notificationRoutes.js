const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware');

// Get My Notification History
router.get('/', authenticate, notificationController.getNotifications);

// Send Notification (System/Admin trigger)
// Ideally this should be protected or internal-only.
// Using authenticate for now, assuming trigger comes from Admin dashboard or background process with a valid token.
router.post('/send', authenticate, notificationController.sendNotification);

// Read Status
router.patch('/:id/read', authenticate, notificationController.markAsRead);
router.patch('/read-all', authenticate, notificationController.markAllAsRead);

module.exports = router;
