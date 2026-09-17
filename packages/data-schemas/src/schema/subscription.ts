import { Schema } from 'mongoose';
import type * as t from '~/types';

const subscriptionSchema: Schema<t.ISubscription> = new Schema<t.ISubscription>({
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    index: true,
    required: true,
  },
  plan: {
    type: String,
    enum: ['basic', 'pro'],
    default: 'basic',
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'cancelled', 'expired', 'pending'],
    default: 'inactive',
    required: true,
  },
  startDate: {
    type: Date,
    default: Date.now,
    required: true,
  },
  endDate: {
    type: Date,
  },
  autoRenew: {
    type: Boolean,
    default: true,
  },
  yookassaCustomerId: {
    type: String,
    index: true,
  },
  yookassaSubscriptionId: {
    type: String,
    unique: true,
    sparse: true,
  },
  lastPaymentDate: {
    type: Date,
  },
  nextBillingDate: {
    type: Date,
  },
  tenantId: {
    type: String,
    index: true,
  },
}, {
  timestamps: true,
});

subscriptionSchema.index({ user: 1, status: 1 });
subscriptionSchema.index({ plan: 1, status: 1 });

export default subscriptionSchema;
