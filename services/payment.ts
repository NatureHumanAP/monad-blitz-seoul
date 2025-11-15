import { BLOCKCHAIN_CONFIG } from '@/config/blockchain';
import { isTimestampValid, verifyPaymentSignature, verifyWalletSignature } from '@/lib/eip712';
import { calculateTransferFee, roundToMinimumUnit } from '@/lib/pricing';
import { PaymentMessage } from '@/lib/types/x402';
import { deductCreditFromChain, getOnChainCreditBalance, verifyTransaction } from '@/services/blockchain';
import { paymentRecords, walletData } from '@/services/metadata';
import { randomBytes } from 'crypto';
import { ethers } from 'ethers';

/**
 * Generate a unique nonce for payment
 */
export function generateNonce(): string {
    return randomBytes(32).toString('hex');
}

/**
 * Create x402 Payment Required response headers
 */
export function createX402Headers(
    amount: number,
    nonce: string
): Record<string, string> {
    const roundedAmount = roundToMinimumUnit(amount);

    return {
        'X-Payment-Required-Amount': roundedAmount.toString(),
        'X-Payment-Address': BLOCKCHAIN_CONFIG.contracts.paymentContract,
        'X-Payment-Token': BLOCKCHAIN_CONFIG.contracts.paymentToken,
        'X-Payment-Nonce': nonce,
        'X-Payment-Chain-Id': BLOCKCHAIN_CONFIG.chainId,
    };
}

/**
 * Verify wallet signature for credit-based payment
 */
export async function verifyCreditPayment(
    walletId: string,
    signature: string,
    message: string
): Promise<boolean> {
    return verifyWalletSignature(message, signature, walletId);
}

/**
 * Verify x402 payment (either on-chain or EIP-712 signature)
 */
export async function verifyX402Payment(
    walletId: string,
    fileId: string,
    amount: number,
    nonce: string,
    signature?: string,
    txHash?: string,
    timestamp?: number
): Promise<boolean> {
    // Check if nonce has been used
    if (await paymentRecords.isNonceUsed(nonce)) {
        return false;
    }

    // Verify on-chain transaction if provided
    if (txHash) {
        // USDC uses 6 decimals
        const amountInUnits = BigInt(Math.floor(amount * 1e6));
        const isValid = await verifyTransaction(txHash, amountInUnits, walletId);
        if (isValid) {
            // Record nonce usage
            await paymentRecords.save({
                nonce,
                walletId,
                fileId,
                usedAt: new Date().toISOString(),
                amount,
            });
            return true;
        }
        return false;
    }

    // Verify EIP-712 signature if provided
    if (signature) {
        // Use provided timestamp or current time
        const messageTimestamp = timestamp || Date.now();

        const message: PaymentMessage = {
            fileId,
            amount,
            nonce,
            timestamp: messageTimestamp,
        };

        // Check timestamp validity
        if (!isTimestampValid(messageTimestamp)) {
            console.error('Invalid timestamp:', messageTimestamp, 'Current time:', Date.now(), 'Difference:', Date.now() - messageTimestamp);
            return false;
        }

        const isValid = await verifyPaymentSignature(message, signature, walletId);
        if (isValid) {
            // Record nonce usage
            await paymentRecords.save({
                nonce,
                walletId,
                fileId,
                usedAt: new Date().toISOString(),
                amount,
            });
            return true;
        }
        console.error('EIP-712 signature verification failed for:', { walletId, fileId, nonce, timestamp: messageTimestamp });
        return false;
    }

    return false;
}

/**
 * Process payment for file download
 * Returns true if payment is successful, false if payment is required
 */
export async function processDownloadPayment(
    walletId: string,
    fileId: string,
    fileSize: number,
    headers: Record<string, string | undefined>
): Promise<{ success: boolean; nonce?: string; amount?: number }> {
    const transferFee = calculateTransferFee(fileSize);
    const roundedFee = roundToMinimumUnit(transferFee);

    // Normalize walletId to lowercase (consistent with storage)
    const normalizedWalletId = walletId.toLowerCase();

    // Check credit balance from on-chain contract (source of truth)
    let currentBalance = 0;
    let hasCredit = false;

    try {
        const onChainBalance = await getOnChainCreditBalance(normalizedWalletId);
        currentBalance = Number(ethers.formatUnits(onChainBalance, 6)); // USDC uses 6 decimals
        hasCredit = currentBalance >= roundedFee;

        console.log(`Download payment check (on-chain) for wallet ${normalizedWalletId}: balance=${currentBalance} USDC, required=${roundedFee} USDC, hasCredit=${hasCredit}`);

        // Sync local balance with on-chain balance
        if (currentBalance > 0) {
            await walletData.updateBalance(normalizedWalletId, currentBalance);
        }
    } catch (error: any) {
        // If RPC is restricted, fallback to local balance
        if (error?.message === 'RPC_METHOD_RESTRICTED') {
            console.debug(`RPC restricted for balance check, using local balance for wallet ${normalizedWalletId}`);
            const creditBalance = await walletData.getById(normalizedWalletId);
            currentBalance = creditBalance?.creditBalance || 0;
            hasCredit = currentBalance >= roundedFee;
            console.log(`Download payment check (local fallback) for wallet ${normalizedWalletId}: balance=${currentBalance} USDC, required=${roundedFee} USDC, hasCredit=${hasCredit}`);
        } else {
            console.error(`Error checking on-chain balance for wallet ${normalizedWalletId}:`, error);
            // Fallback to local balance on any error
            const creditBalance = await walletData.getById(normalizedWalletId);
            currentBalance = creditBalance?.creditBalance || 0;
            hasCredit = currentBalance >= roundedFee;
        }
    }

    if (hasCredit) {
        // Verify wallet signature if provided
        const signature = headers['x-wallet-signature'];
        if (signature) {
            const message = `Download ${fileId}`;
            const isValid = await verifyCreditPayment(normalizedWalletId, signature, message);
            if (isValid) {
                // Deduct credit from on-chain contract first
                const amountInUnits = BigInt(Math.floor(roundedFee * 1e6)); // USDC uses 6 decimals
                try {
                    const deductResult = await deductCreditFromChain(normalizedWalletId, amountInUnits);
                    if (deductResult.success) {
                        // Sync local balance after successful on-chain deduction
                        const newBalance = await walletData.deductCredit(normalizedWalletId, roundedFee);
                        console.log(`Credit deducted (on-chain) for wallet ${normalizedWalletId}: ${roundedFee} USDC, tx: ${deductResult.txHash}, new balance: ${newBalance} USDC`);

                        // Update balance from chain to ensure consistency
                        try {
                            const updatedOnChainBalance = await getOnChainCreditBalance(normalizedWalletId);
                            const balanceInTokens = Number(ethers.formatUnits(updatedOnChainBalance, 6));
                            await walletData.updateBalance(normalizedWalletId, balanceInTokens);
                            console.log(`Balance synced from chain for wallet ${normalizedWalletId}: ${balanceInTokens} USDC`);
                        } catch (error: any) {
                            if (error?.message !== 'RPC_METHOD_RESTRICTED') {
                                console.warn(`Failed to sync balance from chain for wallet ${normalizedWalletId}:`, error);
                            }
                        }

                        return { success: true };
                    } else {
                        console.error(`Failed to deduct credit from chain: ${deductResult.error}`);
                        // If on-chain deduction fails, still try local fallback (for backward compatibility)
                        const newBalance = await walletData.deductCredit(normalizedWalletId, roundedFee);
                        console.log(`Credit deducted (local fallback) for wallet ${normalizedWalletId}: ${roundedFee} USDC, new balance: ${newBalance} USDC`);
                        return { success: true };
                    }
                } catch (error: any) {
                    if (error?.message === 'RPC_METHOD_RESTRICTED') {
                        // RPC restricted, use local fallback
                        console.debug(`RPC restricted for credit deduction, using local fallback for wallet ${normalizedWalletId}`);
                        const newBalance = await walletData.deductCredit(normalizedWalletId, roundedFee);
                        console.log(`Credit deducted (local fallback - RPC restricted) for wallet ${normalizedWalletId}: ${roundedFee} USDC, new balance: ${newBalance} USDC`);
                        return { success: true };
                    }
                    throw error;
                }
            } else {
                console.warn(`Invalid signature for credit payment: wallet ${normalizedWalletId}, file ${fileId}`);
            }
        } else {
            // If no signature but has credit, allow download and deduct credit
            // This allows downloads without requiring signature every time
            const amountInUnits = BigInt(Math.floor(roundedFee * 1e6)); // USDC uses 6 decimals
            try {
                const deductResult = await deductCreditFromChain(normalizedWalletId, amountInUnits);
                if (deductResult.success) {
                    // Sync local balance after successful on-chain deduction
                    const newBalance = await walletData.deductCredit(normalizedWalletId, roundedFee);
                    console.log(`Credit deducted (on-chain, no signature) for wallet ${normalizedWalletId}: ${roundedFee} USDC, tx: ${deductResult.txHash}, new balance: ${newBalance} USDC`);

                    // Update balance from chain to ensure consistency
                    try {
                        const updatedOnChainBalance = await getOnChainCreditBalance(normalizedWalletId);
                        const balanceInTokens = Number(ethers.formatUnits(updatedOnChainBalance, 6));
                        await walletData.updateBalance(normalizedWalletId, balanceInTokens);
                        console.log(`Balance synced from chain for wallet ${normalizedWalletId}: ${balanceInTokens} USDC`);
                    } catch (error: any) {
                        if (error?.message !== 'RPC_METHOD_RESTRICTED') {
                            console.warn(`Failed to sync balance from chain for wallet ${normalizedWalletId}:`, error);
                        }
                    }

                    return { success: true };
                } else {
                    console.error(`Failed to deduct credit from chain: ${deductResult.error}`);
                    // If on-chain deduction fails, still try local fallback (for backward compatibility)
                    const newBalance = await walletData.deductCredit(normalizedWalletId, roundedFee);
                    console.log(`Credit deducted (local fallback) for wallet ${normalizedWalletId}: ${roundedFee} USDC, new balance: ${newBalance} USDC`);
                    return { success: true };
                }
            } catch (error: any) {
                if (error?.message === 'RPC_METHOD_RESTRICTED') {
                    // RPC restricted, use local fallback
                    console.debug(`RPC restricted for credit deduction, using local fallback for wallet ${normalizedWalletId}`);
                    await walletData.deductCredit(normalizedWalletId, roundedFee);
                    console.log(`Credit deducted (local fallback - RPC restricted) for wallet ${normalizedWalletId}: ${roundedFee} USDC`);
                    return { success: true };
                }
                throw error;
            }
        }
    } else {
        console.log(`Insufficient credit for wallet ${normalizedWalletId}: balance=${currentBalance} USDC, required=${roundedFee} USDC`);
    }

    // Check for x402 payment (signature or tx hash)
    const paymentSignature = headers['x-payment-signature'];
    const paymentTxHash = headers['x-payment-tx-hash'];
    const paymentNonce = headers['x-payment-nonce'];
    const paymentTimestamp = headers['x-payment-timestamp'];

    if (paymentSignature || paymentTxHash) {
        if (!paymentNonce) {
            return { success: false };
        }

        const timestamp = paymentTimestamp ? parseInt(paymentTimestamp, 10) : undefined;

        const isValid = await verifyX402Payment(
            walletId,
            fileId,
            roundedFee,
            paymentNonce,
            paymentSignature,
            paymentTxHash,
            timestamp
        );

        if (isValid) {
            return { success: true };
        }
    }

    // Payment required - generate nonce for x402 response
    const nonce = generateNonce();
    return { success: false, nonce, amount: roundedFee };
}

