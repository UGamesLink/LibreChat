const express = require('express');
const router = express.Router();
const { requireJwtAuth } = require('../middleware/');
const subscriptionController = require('../controllers/Subscription');

// Get user's subscription
router.get('/', requireJwtAuth, subscriptionController.getSubscription);

// Get available subscription plans
router.get('/plans', requireJwtAuth, subscriptionController.getPlans);

// Create subscription (initiate payment)
router.post('/create', requireJwtAuth, subscriptionController.createSubscription);

// Cancel subscription
router.post('/cancel', requireJwtAuth, subscriptionController.cancelSubscription);

// YooKassa webhook for payment notifications
router.post('/webhook/yookassa', subscriptionController.handleWebhook);

module.exports = router;
