import { walletData, fileMetadata } from '@/services/metadata';
import { deductCreditFromChain, getOnChainCreditBalance } from '@/services/blockchain';
import { ethers } from 'ethers';

/**
 * Get credit balance for a wallet (from on-chain contract)
 * Checks on-chain contract first, falls back to local metadata if RPC is restricted
 */
export async function getCreditBalance(walletId: string): Promise<number> {
  try {
    // Try to get balance from on-chain contract (source of truth)
    const onChainBalance = await getOnChainCreditBalance(walletId);
    const balanceInTokens = Number(ethers.formatUnits(onChainBalance, 6));
    
    // Sync local balance with on-chain balance
    if (balanceInTokens > 0) {
      await walletData.updateBalance(walletId, balanceInTokens);
    }
    
    return balanceInTokens;
  } catch (error: any) {
    // If RPC is restricted, fallback to local balance
    if (error?.message === 'RPC_METHOD_RESTRICTED') {
      console.debug(`RPC restricted for balance query, using local balance for wallet ${walletId}`);
      const wallet = await walletData.getById(walletId);
      return wallet?.creditBalance || 0;
    }
    // For other errors, still fallback to local balance
    console.warn(`Error getting on-chain balance for wallet ${walletId}, using local balance:`, error?.message || error);
    const wallet = await walletData.getById(walletId);
    return wallet?.creditBalance || 0;
  }
}

/**
 * Update credit balance (when deposit event is received)
 */
export async function updateCreditBalance(
  walletId: string,
  amount: bigint
): Promise<void> {
  // Convert from token units to human readable (USDC uses 6 decimals)
  const amountInTokens = Number(ethers.formatUnits(amount, 6));
  
  // Add credit to wallet
  await walletData.addCredit(walletId, amountInTokens);
  
  // Update isPrepaidLinked flag for all files of this wallet
  await fileMetadata.updatePrepaidLinkedByWallet(walletId, true);
}

/**
 * Deduct credit from wallet (both on-chain and local)
 * Tries on-chain deduction first, falls back to local if RPC is restricted
 */
export async function deductCredit(
  walletId: string,
  amount: number
): Promise<number> {
  // Convert amount to token units (USDC uses 6 decimals)
  const amountInUnits = BigInt(Math.floor(amount * 1e6));
  
  try {
    // Try to deduct from on-chain contract first
    const deductResult = await deductCreditFromChain(walletId, amountInUnits);
    
    if (deductResult.success) {
      // Sync local balance after successful on-chain deduction
      const newBalance = await walletData.deductCredit(walletId, amount);
      console.log(`Credit deducted (on-chain) for wallet ${walletId}: ${amount} USDC, tx: ${deductResult.txHash}, new balance: ${newBalance} USDC`);
      return newBalance;
    } else {
      // If on-chain deduction fails (e.g., insufficient balance), still try local for consistency
      console.warn(`On-chain deduction failed: ${deductResult.error}, falling back to local deduction for wallet ${walletId}`);
      return await walletData.deductCredit(walletId, amount);
    }
  } catch (error: any) {
    // If RPC is restricted, fallback to local deduction
    if (error?.message === 'RPC_METHOD_RESTRICTED') {
      console.debug(`RPC restricted for credit deduction, using local deduction for wallet ${walletId}`);
      return await walletData.deductCredit(walletId, amount);
    }
    // For other errors, still try local deduction
    console.warn(`Error deducting credit from chain for wallet ${walletId}, using local deduction:`, error?.message || error);
    return await walletData.deductCredit(walletId, amount);
  }
}

/**
 * Check if wallet has sufficient credit
 */
export async function hasSufficientCredit(
  walletId: string,
  requiredAmount: number
): Promise<boolean> {
  const balance = await getCreditBalance(walletId);
  return balance >= requiredAmount;
}

/**
 * Sync credit balance from on-chain (optional, for verification)
 * Only use this when RPC is available (e.g., after deposit verification)
 */
export async function syncCreditBalanceFromChain(walletId: string): Promise<void> {
  try {
    const { getOnChainCreditBalance } = await import('@/services/blockchain');
    const onChainBalance = await getOnChainCreditBalance(walletId);
    const balanceInTokens = Number(ethers.formatUnits(onChainBalance, 6));
    
    // Update local balance (this is just for sync, actual updates come from events)
    await walletData.updateBalance(walletId, balanceInTokens);
    console.log(`Synced balance from chain for wallet ${walletId}: ${balanceInTokens} USDC`);
  } catch (error: any) {
    // Silently handle RPC restrictions - this is expected in many cases
    if (error?.message === 'RPC_METHOD_RESTRICTED') {
      console.debug(`Cannot sync balance from chain for wallet ${walletId}: RPC restricted`);
      return;
    }
    console.warn(`Error syncing credit balance from chain for wallet ${walletId}:`, error?.message || error);
  }
}

