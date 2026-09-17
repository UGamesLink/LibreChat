const { Subscription, Balance, Transaction } = require('~/models');
const { SubscriptionPlan, SubscriptionStatus } = require('@librechat/data-schemas/types');
const logger = require('~/config/winston');

class SubscriptionService {
  /**
   * Get user's subscription by user ID
   * @param {string} userId - User ID
   * @returns {Promise<Object|null>} Subscription object or null
   */
  async getSubscriptionByUser(userId) {
    try {
      const subscription = await Subscription.findOne({ 
        user: userId,
        status: { $in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PENDING] }
      }).lean();
      
      return subscription;
    } catch (error) {
      logger.error('[SubscriptionService] Error getting subscription:', error);
      throw error;
    }
  }

  /**
   * Create or update user subscription
   * @param {string} userId - User ID
   * @param {Object} subscriptionData - Subscription data
   * @returns {Promise<Object>} Updated subscription
   */
  async upsertSubscription(userId, subscriptionData) {
    try {
      const update = {
        ...subscriptionData,
        updatedAt: new Date(),
      };

      const subscription = await Subscription.findOneAndUpdate(
        { user: userId },
        update,
        { 
          new: true, 
          upsert: true,
          lean: true 
        }
      );

      return subscription;
    } catch (error) {
      logger.error('[SubscriptionService] Error upserting subscription:', error);
      throw error;
    }
  }

  /**
   * Activate subscription
   * @param {string} userId - User ID
   * @param {string} yookassaSubscriptionId - YooKassa subscription ID
   * @returns {Promise<Object>} Updated subscription
   */
  async activateSubscription(userId, yookassaSubscriptionId) {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { 
          user: userId,
          yookassaSubscriptionId: yookassaSubscriptionId
        },
        {
          status: SubscriptionStatus.ACTIVE,
          startDate: new Date(),
          updatedAt: new Date(),
        },
        { new: true, lean: true }
      );

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      return subscription;
    } catch (error) {
      logger.error('[SubscriptionService] Error activating subscription:', error);
      throw error;
    }
  }

  /**
   * Cancel subscription
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Updated subscription
   */
  async cancelSubscription(userId) {
    try {
      const subscription = await Subscription.findOneAndUpdate(
        { user: userId },
        {
          status: SubscriptionStatus.CANCELLED,
          endDate: new Date(),
          autoRenew: false,
          updatedAt: new Date(),
        },
        { new: true, lean: true }
      );

      if (!subscription) {
        throw new Error('Subscription not found');
      }

      return subscription;
    } catch (error) {
      logger.error('[SubscriptionService] Error cancelling subscription:', error);
      throw error;
    }
  }

  /**
   * Check if user has active PRO subscription
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} True if user has active PRO subscription
   */
  async hasActiveProSubscription(userId) {
    try {
      const subscription = await Subscription.findOne({
        user: userId,
        plan: SubscriptionPlan.PRO,
        status: SubscriptionStatus.ACTIVE,
      }).lean();

      return !!subscription;
    } catch (error) {
      logger.error('[SubscriptionService] Error checking PRO subscription:', error);
      return false;
    }
  }

  /**
   * Get user's balance in rubles
   * @param {string} userId - User ID
   * @returns {Promise<number>} Balance in rubles
   */
  async getUserBalance(userId) {
    try {
      const balance = await Balance.findOne({ user: userId }).lean();
      return balance?.rubles || 0;
    } catch (error) {
      logger.error('[SubscriptionService] Error getting user balance:', error);
      return 0;
    }
  }

  /**
   * Add funds to user balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to add in rubles
   * @param {string} transactionId - Transaction ID
   * @returns {Promise<Object>} Updated balance
   */
  async addFunds(userId, amount, transactionId) {
    try {
      const balance = await Balance.findOne({ user: userId });
      
      if (!balance) {
        // Create new balance record
        const newBalance = await Balance.create({
          user: userId,
          rubles: amount,
          tokenCredits: 0,
        });
        
        // Create transaction record
        await Transaction.create({
          user: userId,
          type: 'deposit',
          amount: amount,
          currency: 'RUB',
          status: 'completed',
          transactionId: transactionId,
        });
        
        return newBalance;
      }

      // Update existing balance
      balance.rubles += amount;
      await balance.save();

      // Create transaction record
      await Transaction.create({
        user: userId,
        type: 'deposit',
        amount: amount,
        currency: 'RUB',
        status: 'completed',
        transactionId: transactionId,
      });

      return balance;
    } catch (error) {
      logger.error('[SubscriptionService] Error adding funds:', error);
      throw error;
    }
  }

  /**
   * Deduct funds from user balance
   * @param {string} userId - User ID
   * @param {number} amount - Amount to deduct in rubles
   * @param {string} description - Description of the charge
   * @returns {Promise<boolean>} True if successful
   */
  async deductFunds(userId, amount, description = '') {
    try {
      const balance = await Balance.findOne({ user: userId });
      
      if (!balance || balance.rubles < amount) {
        return false;
      }

      balance.rubles -= amount;
      await balance.save();

      // Create transaction record
      await Transaction.create({
        user: userId,
        type: 'charge',
        amount: -amount,
        currency: 'RUB',
        status: 'completed',
        description: description,
      });

      return true;
    } catch (error) {
      logger.error('[SubscriptionService] Error deducting funds:', error);
      return false;
    }
  }

  /**
   * Get subscription plans with pricing
   * @returns {Array<Object>} Array of subscription plans
   */
  getSubscriptionPlans() {
    return [
      {
        id: SubscriptionPlan.BASIC,
        name: 'Базовый',
        description: 'Пользование настроенными чатами',
        price: 0,
        currency: 'RUB',
        features: [
          'Доступ к настроенным чатам',
          'Оплата за использование в рублях',
          'Базовая поддержка',
        ],
        limitations: [
          'Нет доступа к своим API ключам',
          'Нет возможности вводить свои токены',
        ],
      },
      {
        id: SubscriptionPlan.PRO,
        name: 'PRO',
        description: 'Полный доступ со своими API',
        price: 990,
        currency: 'RUB',
        billingPeriod: 'month',
        features: [
          'Все возможности базового плана',
          'Доступ к своим API ключам',
          'Возможность вводить свои токены',
          'Приоритетная поддержка',
          'Расширенные настройки',
        ],
      },
    ];
  }
}

module.exports = new SubscriptionService();
