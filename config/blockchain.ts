import { readFileSync } from 'fs';
import path from 'path';

// Load contract addresses (if exists)
let contractAddresses: {
    contracts?: {
        StorageCreditPool?: { address?: string; paymentToken?: string };
        PaymentContract?: { address?: string; paymentToken?: string };
    };
} = {};

try {
    const addressesPath = path.join(process.cwd(), 'contracts', 'deployments', 'addresses.json');
    contractAddresses = JSON.parse(readFileSync(addressesPath, 'utf-8'));
} catch (error) {
    // deployments/addresses.json doesn't exist yet
    console.warn('Contract addresses file not found. Using environment variables.');
}

// Helper function to get contract address with fallback
function getContractAddress(
    contractName: 'StorageCreditPool' | 'PaymentContract',
    envVar: string | undefined
): string {
    // Priority: env var > addresses.json > empty string
    if (envVar) {
        return envVar;
    }

    const contract = contractAddresses.contracts?.[contractName];
    if (contract?.address) {
        return contract.address;
    }

    return '';
}

// Helper function to get payment token address
function getPaymentTokenAddress(envVar: string | undefined): string {
    // Priority: env var > addresses.json (from either contract) > empty string
    if (envVar) {
        return envVar;
    }

    // Try to get from StorageCreditPool first, then PaymentContract
    const storageCreditPool = contractAddresses.contracts?.StorageCreditPool;
    if (storageCreditPool?.paymentToken) {
        return storageCreditPool.paymentToken;
    }

    const paymentContract = contractAddresses.contracts?.PaymentContract;
    if (paymentContract?.paymentToken) {
        return paymentContract.paymentToken;
    }

    return '';
}

export const BLOCKCHAIN_CONFIG = {
    // Monad chain ID
    chainId: '10143',

    // RPC URL
    rpcUrl: 'https://rpc-testnet.monadinfra.com',

    // Contract addresses (from deployments or env)
    contracts: {
        storageCreditPool: getContractAddress('StorageCreditPool', process.env.STORAGE_CREDIT_POOL_ADDRESS),
        paymentContract: getContractAddress('PaymentContract', process.env.PAYMENT_CONTRACT_ADDRESS),
        paymentToken: getPaymentTokenAddress(process.env.PAYMENT_TOKEN_ADDRESS),
    },

    // Contract ABIs path
    abiPaths: {
        storageCreditPool: path.join(process.cwd(), 'contracts', 'artifacts', 'contracts', 'StorageCreditPool.sol', 'StorageCreditPool.json'),
        paymentContract: path.join(process.cwd(), 'contracts', 'artifacts', 'contracts', 'PaymentContract.sol', 'PaymentContract.json'),
    },

    // Payment settings
    payment: {
        signatureValidityWindow: 5 * 60 * 1000, // 5 minutes in milliseconds
    },
} as const;

