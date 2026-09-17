const subscriptionService = require('~/server/services/SubscriptionService');
const { SubscriptionPlan } = require('@librechat/data-schemas/types');
const logger = require('~/config/winston');

// YooKassa configuration
const YOOKASSA_SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const YOOKASSA_SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;
const YOOKASSA_RETURN_URL = process.env.YOOKASSA_RETURN_URL || `${process.env.DOMAIN_SERVER}/subscription/success`;

/**
 * Get user's current subscription
 */
async function getSubscription(req, res) {
  try {
    const userId = req.user.id;
    
    const subscription = await subscriptionService.getSubscriptionByUser(userId);
    const balance = await subscriptionService.getUserBalance(userId);
    
    res.json({
      subscription: subscription || null,
      balance: balance,
      hasProAccess: subscription?.plan === SubscriptionPlan.PRO && subscription?.status === 'active',
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error getting subscription:', error);
    res.status(500).json({ error: 'Failed to get subscription data' });
  }
}

/**
 * Get available subscription plans
 */
async function getPlans(req, res) {
  try {
    const plans = subscriptionService.getSubscriptionPlans();
    res.json({ plans });
  } catch (error) {
    logger.error('[SubscriptionController] Error getting plans:', error);
    res.status(500).json({ error: 'Failed to get subscription plans' });
  }
}

/**
 * Create subscription and initiate YooKassa payment
 */
async function createSubscription(req, res) {
  try {
    const userId = req.user.id;
    const { plan, amount } = req.body;
    
    // Validate plan
    if (!plan || !Object.values(SubscriptionPlan).includes(plan)) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    // For PRO plan, validate amount
    if (plan === SubscriptionPlan.PRO && (!amount || amount < 990)) {
      return res.status(400).json({ error: 'Invalid amount for PRO plan' });
    }

    // Create or update subscription
    const subscriptionData = {
      user: userId,
      plan: plan,
      status: 'pending',
      autoRenew: true,
    };

    const subscription = await subscriptionService.upsertSubscription(userId, subscriptionData);

    // For balance top-up (deposit)
    if (amount && plan === SubscriptionPlan.BASIC) {
      // Create YooKassa payment for balance top-up
      const paymentData = await createYooKassaPayment(userId, amount, 'Пополнение баланса');
      
      return res.json({
        subscriptionId: subscription._id,
        paymentUrl: paymentData.confirmation.confirmation_url,
        paymentId: paymentData.id,
        message: 'Please complete the payment',
      });
    }

    // For PRO subscription
    if (plan === SubscriptionPlan.PRO) {
      const paymentData = await createYooKassaPayment(userId, amount, 'Подписка PRO на месяц');
      
      return res.json({
        subscriptionId: subscription._id,
        paymentUrl: paymentData.confirmation.confirmation_url,
        paymentId: paymentData.id,
        message: 'Please complete the payment for PRO subscription',
      });
    }

    // For BASIC plan (free)
    res.json({
      subscriptionId: subscription._id,
      message: 'BASIC plan activated',
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error creating subscription:', error);
    res.status(500).json({ error: 'Failed to create subscription' });
  }
}

/**
 * Cancel user's subscription
 */
async function cancelSubscription(req, res) {
  try {
    const userId = req.user.id;
    
    const subscription = await subscriptionService.cancelSubscription(userId);
    
    res.json({
      message: 'Subscription cancelled successfully',
      subscription: subscription,
    });
  } catch (error) {
    logger.error('[SubscriptionController] Error cancelling subscription:', error);
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
}

/**
 * Handle YooKassa webhook notifications
 */
async function handleWebhook(req, res) {
  try {
    const { type, object } = req.body;
    
    logger.info('[YooKassa Webhook] Received event:', type);
    
    if (type === 'payment.succeeded') {
      const payment = object;
      const userId = payment.metadata?.user_id;
      const amount = parseFloat(payment.amount.value);
      const description = payment.description;
      
      if (!userId) {
        logger.error('[YooKassa Webhook] Missing user_id in payment metadata');
        return res.status(400).json({ error: 'Missing user_id' });
      }
      
      // Add funds to user balance
      await subscriptionService.addFunds(userId, amount, payment.id);
      
      // If this is a PRO subscription payment, activate it
      if (description?.includes('PRO')) {
        await subscriptionService.activateSubscription(userId, payment.id);
      }
      
      logger.info(`[YooKassa Webhook] Payment processed for user ${userId}, amount: ${amount} RUB`);
    } else if (type === 'payment.canceled') {
      const payment = object;
      const userId = payment.metadata?.user_id;
      
      if (userId) {
        logger.info(`[YooKassa Webhook] Payment canceled for user ${userId}`);
        // Optionally update subscription status to cancelled
      }
    }
    
    res.status(200).json({ status: 'ok' });
  } catch (error) {
    logger.error('[SubscriptionController] Error handling webhook:', error);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

/**
 * Create YooKassa payment
 * @param {string} userId - User ID
 * @param {number} amount - Amount in RUB
 * @param {string} description - Payment description
 * @returns {Promise<Object>} YooKassa payment object
 */
async function createYooKassaPayment(userId, amount, description) {
  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${YOOKASSA_SHOP_ID}:${YOOKASSA_SECRET_KEY}`).toString('base64')}`,
        'Idempotence-Key': `${userId}-${Date.now()}`,
      },
      body: JSON.stringify({
        amount: {
          value: amount.toString(),
          currency: 'RUB',
        },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: YOOKASSA_RETURN_URL,
        },
        description: description,
        metadata: {
          user_id: userId,
        },
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`YooKassa API error: ${JSON.stringify(errorData)}`);
    }
    
    const paymentData = await response.json();
    return paymentData;
  } catch (error) {
    logger.error('[YooKassa] Error creating payment:', error);
    throw error;
  }
}

module.exports = {
  getSubscription,
  getPlans,
  createSubscription,
  cancelSubscription,
  handleWebhook,
};
