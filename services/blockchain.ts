import { ethers } from 'ethers';
import { readFileSync } from 'fs';
import { BLOCKCHAIN_CONFIG } from '@/config/blockchain';

// Provider instance (singleton)
let provider: ethers.Provider | null = null;

/**
 * Get ethers provider instance
 */
export function getProvider(): ethers.Provider {
  if (!provider) {
    provider = new ethers.JsonRpcProvider(BLOCKCHAIN_CONFIG.rpcUrl);
  }
  return provider;
}

/**
 * Load contract ABI from file
 */
function loadContractABI(abiPath: string): any[] {
  try {
    const artifact = JSON.parse(readFileSync(abiPath, 'utf-8'));
    return artifact.abi;
  } catch (error) {
    throw new Error(`Failed to load contract ABI from ${abiPath}: ${error}`);
  }
}

/**
 * Get StorageCreditPool contract instance
 */
export function getStorageCreditPoolContract(): ethers.Contract {
  const abi = loadContractABI(BLOCKCHAIN_CONFIG.abiPaths.storageCreditPool);
  const address = BLOCKCHAIN_CONFIG.contracts.storageCreditPool;
  
  if (!address) {
    throw new Error('StorageCreditPool contract address not configured');
  }

  return new ethers.Contract(address, abi, getProvider());
}

/**
 * Get PaymentContract instance
 */
export function getPaymentContract(): ethers.Contract {
  const abi = loadContractABI(BLOCKCHAIN_CONFIG.abiPaths.paymentContract);
  const address = BLOCKCHAIN_CONFIG.contracts.paymentContract;
  
  if (!address) {
    throw new Error('PaymentContract address not configured');
  }

  return new ethers.Contract(address, abi, getProvider());
}

/**
 * Verify on-chain transaction
 */
export async function verifyTransaction(
  txHash: string,
  expectedAmount: bigint,
  expectedWalletId: string
): Promise<boolean> {
  try {
    const provider = getProvider();
    const tx = await provider.getTransaction(txHash);
    
    if (!tx) {
      return false;
    }

    // Wait for transaction receipt
    const receipt = await provider.waitForTransaction(txHash);
    
    if (!receipt || receipt.status !== 1) {
      return false;
    }

    // Verify transaction is to payment contract
    if (receipt.to?.toLowerCase() !== BLOCKCHAIN_CONFIG.contracts.paymentContract.toLowerCase()) {
      return false;
    }

    // Verify from address matches expected wallet
    if (tx.from.toLowerCase() !== expectedWalletId.toLowerCase()) {
      return false;
    }

    // Note: Amount verification would require parsing the transaction data
    // For now, we just verify the transaction exists and is successful
    return true;
  } catch (error) {
    console.error('Transaction verification error:', error);
    return false;
  }
}

/**
 * Listen for CreditDeposited events
 */
export async function listenForCreditDeposits(
  callback: (walletId: string, amount: bigint) => void
): Promise<void> {
  const contract = getStorageCreditPoolContract();
  
  contract.on('CreditDeposited', (walletId: string, amount: bigint) => {
    callback(walletId, amount);
  });
}

/**
 * Get credit balance from on-chain contract
 */
export async function getOnChainCreditBalance(walletId: string): Promise<bigint> {
  try {
    const contract = getStorageCreditPoolContract();
    return await contract.creditBalance(walletId);
  } catch (error) {
    console.error('Error getting on-chain credit balance:', error);
    return BigInt(0);
  }
}

