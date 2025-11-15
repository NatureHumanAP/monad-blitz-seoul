// Client-side blockchain configuration
// This file is safe to use in client components (no fs, path, etc.)

// Default contract addresses (from deployments/addresses.json)
// These can be overridden with NEXT_PUBLIC_* environment variables
const DEFAULT_STORAGE_CREDIT_POOL = '0x002ad5d032Ba1D1254980da463A69F2C2e9138F7';
const DEFAULT_PAYMENT_CONTRACT = '0x8ae2df7E7E3F8b5d340e53fDecfBEf761c7227EE';
const DEFAULT_PAYMENT_TOKEN = '0x534b2f3A21130d7a60830c2Df862319e593943A3';

export const BLOCKCHAIN_CONFIG_CLIENT = {
    // Monad chain ID
    chainId: '10143',

    // Contract addresses (from environment variables or defaults)
    contracts: {
        storageCreditPool: DEFAULT_STORAGE_CREDIT_POOL,
        paymentContract: DEFAULT_PAYMENT_CONTRACT,
        paymentToken: DEFAULT_PAYMENT_TOKEN,
    },

    // Payment settings
    payment: {
        signatureValidityWindow: 5 * 60 * 1000, // 5 minutes in milliseconds
    },
} as const;

