import { Model } from 'mongoose';
import type * as t from '~/types';
import { applyTenantIsolation } from '~/models/plugins/tenantIsolation';
import subscriptionSchema from '~/schema/subscription';

export function createSubscriptionModel(mongoose: typeof import('mongoose')): Model<t.ISubscription> {
  applyTenantIsolation(subscriptionSchema);
  return mongoose.models.Subscription || mongoose.model<t.ISubscription>('Subscription', subscriptionSchema);
}
