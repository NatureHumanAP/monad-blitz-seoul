import { walletData, fileMetadata } from "@/services/metadata";
import { getOnChainCreditBalance } from "@/services/blockchain";
import { ethers } from "ethers";

/**
 * Get credit balance for a wallet (from local metadata)
 */
export async function getCreditBalance(walletId: string): Promise<number> {
    const wallet = await walletData.getById(walletId);
    return wallet?.creditBalance || 0;
}

/**
 * Update credit balance (when deposit event is received)
 */
export async function updateCreditBalance(
    walletId: string,
    amount: bigint,
): Promise<void> {
    // Convert from wei to token units (assuming 18 decimals)
    const amountInTokens = Number(ethers.formatEther(amount));
  
    // Add credit to wallet
    await walletData.addCredit(walletId, amountInTokens);
  
    // Update isPrepaidLinked flag for all files of this wallet
    await fileMetadata.updatePrepaidLinkedByWallet(walletId, true);
}

/**
 * Deduct credit from wallet
 */
export async function deductCredit(
    walletId: string,
    amount: number,
): Promise<number> {
    return await walletData.deductCredit(walletId, amount);
}

/**
 * Check if wallet has sufficient credit
 */
export async function hasSufficientCredit(
    walletId: string,
    requiredAmount: number,
): Promise<boolean> {
    const balance = await getCreditBalance(walletId);
    return balance >= requiredAmount;
}

/**
 * Sync credit balance from on-chain (optional, for verification)
 */
export async function syncCreditBalanceFromChain(walletId: string): Promise<void> {
    try {
        const onChainBalance = await getOnChainCreditBalance(walletId);
        const balanceInTokens = Number(ethers.formatEther(onChainBalance));
    
        // Update local balance (this is just for sync, actual updates come from events)
        await walletData.updateBalance(walletId, balanceInTokens);
    } catch (error) {
        console.error("Error syncing credit balance from chain:", error);
    }
}

