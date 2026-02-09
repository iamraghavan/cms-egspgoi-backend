const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { roleMiddleware } = require('../middleware/roleMiddleware');

// Route to send "Call Not Reachable" message to a lead
router.post('/leads/:id/not-reachable', authMiddleware, roleMiddleware('agent', 'super_admin'), whatsappController.sendCallNotReachableMessage);

module.exports = router;
