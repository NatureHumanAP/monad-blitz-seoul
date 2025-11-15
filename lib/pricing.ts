/**
 * Pricing calculations for Nano Storage
 * Based on SERVICE_LOGIC_DETAIL.md
 */

// Storage fee: $0.005 per GB per day
const STORAGE_FEE_PER_GB_PER_DAY = 0.005;

// Transfer fee: $0.01 per GB per download
const TRANSFER_FEE_PER_GB = 0.01;

// Minimum payment unit: $0.0001
export const MIN_PAYMENT_UNIT = 0.0001;

/**
 * Calculate daily storage fee for a file
 */
export function calculateDailyStorageFee(fileSizeInBytes: number): number {
  const fileSizeInGB = fileSizeInBytes / (1024 * 1024 * 1024);
  return fileSizeInGB * STORAGE_FEE_PER_GB_PER_DAY;
}

/**
 * Calculate monthly storage fee for a file
 */
export function calculateMonthlyStorageFee(fileSizeInBytes: number): number {
  return calculateDailyStorageFee(fileSizeInBytes) * 30;
}

/**
 * Calculate transfer fee for downloading a file
 */
export function calculateTransferFee(fileSizeInBytes: number): number {
  const fileSizeInGB = fileSizeInBytes / (1024 * 1024 * 1024);
  return fileSizeInGB * TRANSFER_FEE_PER_GB;
}

/**
 * Calculate how many days a credit balance can cover
 */
export function calculateDaysCovered(
  creditBalance: number,
  totalDailyFee: number
): number {
  if (totalDailyFee === 0) {
    return Infinity;
  }
  return Math.floor(creditBalance / totalDailyFee);
}

/**
 * Round to minimum payment unit
 */
export function roundToMinimumUnit(amount: number): number {
  return Math.ceil(amount / MIN_PAYMENT_UNIT) * MIN_PAYMENT_UNIT;
}

