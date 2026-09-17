import type { Types } from 'mongoose';

export interface ISubscription {
  user: Types.ObjectId;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  startDate: Date;
  endDate?: Date;
  autoRenew: boolean;
  yookassaCustomerId?: string;
  yookassaSubscriptionId?: string;
  lastPaymentDate?: Date;
  nextBillingDate?: Date;
  tenantId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export enum SubscriptionPlan {
  BASIC = 'basic',
  PRO = 'pro',
}

export enum SubscriptionStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PENDING = 'pending',
}

export interface ISubscriptionUpdate {
  user?: string;
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  startDate?: Date;
  endDate?: Date;
  autoRenew?: boolean;
  yookassaCustomerId?: string;
  yookassaSubscriptionId?: string;
  lastPaymentDate?: Date;
  nextBillingDate?: Date;
}
