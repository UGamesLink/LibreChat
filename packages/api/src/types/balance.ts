import type { RefillIntervalUnit } from 'librechat-data-provider';

export interface BalanceUpdateFields {
  user?: string;
  tokenCredits?: number;
  rubles?: number;
  autoRefillEnabled?: boolean;
  refillIntervalValue?: number;
  refillIntervalUnit?: RefillIntervalUnit;
  refillAmount?: number;
  lastRefill?: Date;
}
