import { randomBytes } from "crypto";
import { walletData, paymentRecords } from "@/services/metadata";
import { verifyPaymentSignature, verifyWalletSignature, isTimestampValid } from "@/lib/eip712";
import { verifyTransaction } from "@/services/blockchain";
import { BLOCKCHAIN_CONFIG } from "@/config/blockchain";
import { PaymentMessage } from "@/lib/types/x402";
import { calculateTransferFee } from "@/lib/pricing";
import { roundToMinimumUnit } from "@/lib/pricing";

/**
 * Generate a unique nonce for payment
 */
export function generateNonce(): string {
    return randomBytes(32).toString("hex");
}

/**
 * Create x402 Payment Required response headers
 */
export function createX402Headers(
    amount: number,
    nonce: string,
): Record<string, string> {
    const roundedAmount = roundToMinimumUnit(amount);
  
    return {
        "X-Payment-Required-Amount": roundedAmount.toString(),
        "X-Payment-Address": BLOCKCHAIN_CONFIG.contracts.paymentContract,
        "X-Payment-Token": BLOCKCHAIN_CONFIG.contracts.paymentToken,
        "X-Payment-Nonce": nonce,
        "X-Payment-Chain-Id": BLOCKCHAIN_CONFIG.chainId,
    };
}

/**
 * Verify wallet signature for credit-based payment
 */
export async function verifyCreditPayment(
    walletId: string,
    signature: string,
    message: string,
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
): Promise<boolean> {
    // Check if nonce has been used
    if (await paymentRecords.isNonceUsed(nonce)) {
        return false;
    }

    // Verify on-chain transaction if provided
    if (txHash) {
        const amountInWei = BigInt(Math.floor(amount * 1e18)); // Assuming 18 decimals
        const isValid = await verifyTransaction(txHash, amountInWei, walletId);
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
        const timestamp = Date.now();
        const message: PaymentMessage = {
            fileId,
            amount,
            nonce,
            timestamp,
        };

        // Check timestamp validity
        if (!isTimestampValid(timestamp)) {
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
    headers: Record<string, string | undefined>,
): Promise<{ success: boolean; nonce?: string; amount?: number }> {
    const transferFee = calculateTransferFee(fileSize);
    const roundedFee = roundToMinimumUnit(transferFee);

    // Check credit balance first (prepaid model)
    const creditBalance = await walletData.getById(walletId);
    const hasCredit = creditBalance && creditBalance.creditBalance >= roundedFee;

    if (hasCredit) {
    // Verify wallet signature if provided
        const signature = headers["x-wallet-signature"];
        if (signature) {
            const message = `Download ${fileId}`;
            const isValid = await verifyCreditPayment(walletId, signature, message);
            if (isValid) {
                // Deduct credit
                await walletData.deductCredit(walletId, roundedFee);
                return { success: true };
            }
        }
    // If no signature but has credit, we might still allow (depending on security requirements)
    // For now, require signature for credit-based payments
    }

    // Check for x402 payment (signature or tx hash)
    const paymentSignature = headers["x-payment-signature"];
    const paymentTxHash = headers["x-payment-tx-hash"];
    const paymentNonce = headers["x-payment-nonce"];

    if (paymentSignature || paymentTxHash) {
        if (!paymentNonce) {
            return { success: false };
        }

        const isValid = await verifyX402Payment(
            walletId,
            fileId,
            roundedFee,
            paymentNonce,
            paymentSignature,
            paymentTxHash,
        );

        if (isValid) {
            return { success: true };
        }
    }

    // Payment required - generate nonce for x402 response
    const nonce = generateNonce();
    return { success: false, nonce, amount: roundedFee };
}

