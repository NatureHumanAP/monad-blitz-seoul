import { ethers } from 'ethers';
import { BLOCKCHAIN_CONFIG } from '@/config/blockchain';
import { PaymentMessage } from '@/lib/types/x402';

/**
 * EIP-712 Domain for payment messages
 */
function getDomain() {
  return {
    name: 'Nano Storage',
    version: '1',
    chainId: parseInt(BLOCKCHAIN_CONFIG.chainId),
    verifyingContract: BLOCKCHAIN_CONFIG.contracts.paymentContract,
  };
}

/**
 * EIP-712 Types for payment messages
 */
const PAYMENT_TYPES = {
  Payment: [
    { name: 'fileId', type: 'string' },
    { name: 'amount', type: 'uint256' },
    { name: 'nonce', type: 'string' },
    { name: 'timestamp', type: 'uint256' },
  ],
};

/**
 * Verify EIP-712 signature for payment
 */
export async function verifyPaymentSignature(
  message: PaymentMessage,
  signature: string,
  expectedWalletId: string
): Promise<boolean> {
  try {
    const domain = getDomain();
    const recoveredAddress = ethers.verifyTypedData(
      domain,
      PAYMENT_TYPES,
      message,
      signature
    );

    return recoveredAddress.toLowerCase() === expectedWalletId.toLowerCase();
  } catch (error) {
    console.error('EIP-712 signature verification error:', error);
    return false;
  }
}

/**
 * Verify wallet signature (simple message signature)
 */
export function verifyWalletSignature(
  message: string,
  signature: string,
  expectedWalletId: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedWalletId.toLowerCase();
  } catch (error) {
    console.error('Wallet signature verification error:', error);
    return false;
  }
}

/**
 * Check if timestamp is within validity window
 */
export function isTimestampValid(timestamp: number): boolean {
  const now = Date.now();
  const window = BLOCKCHAIN_CONFIG.payment.signatureValidityWindow;
  return Math.abs(now - timestamp) <= window;
}

