import path from 'path';
import { readFileSync } from 'fs';

// Load contract addresses (if exists)
let contractAddresses: Record<string, string> = {};

try {
  const addressesPath = path.join(process.cwd(), 'contracts', 'deployments', 'addresses.json');
  contractAddresses = JSON.parse(readFileSync(addressesPath, 'utf-8'));
} catch (error) {
  // deployments/addresses.json doesn't exist yet
  console.warn('Contract addresses file not found. Using environment variables.');
}

export const BLOCKCHAIN_CONFIG = {
  // Monad chain ID
  chainId: process.env.MONAD_CHAIN_ID || '41500',
  
  // RPC URL
  rpcUrl: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
  
  // Contract addresses (from deployments or env)
  contracts: {
    storageCreditPool: process.env.STORAGE_CREDIT_POOL_ADDRESS || contractAddresses.StorageCreditPool || '',
    paymentContract: process.env.PAYMENT_CONTRACT_ADDRESS || contractAddresses.PaymentContract || '',
    paymentToken: process.env.PAYMENT_TOKEN_ADDRESS || contractAddresses.MockERC20 || '',
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

