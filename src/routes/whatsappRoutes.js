const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authenticate, roleMiddleware } = require('../middleware/authMiddleware');

// Route to send "Call Not Reachable" message to a lead
router.post('/leads/:id/not-reachable', authenticate, roleMiddleware('agent', 'super_admin'), whatsappController.sendCallNotReachableMessage);

module.exports = router;
