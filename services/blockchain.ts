import { BLOCKCHAIN_CONFIG } from '@/config/blockchain';
import { ethers } from 'ethers';
import { readFileSync } from 'fs';

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
        const balance = await contract.creditBalance(walletId);
        return balance;
    } catch (error: any) {
        // Silently handle RPC restrictions
        if (error?.info?.responseStatus === 403 || error?.shortMessage?.includes('403')) {
            console.debug(`RPC restricted for balance query: ${walletId}`);
            throw new Error('RPC_METHOD_RESTRICTED');
        }
        console.error('Error getting on-chain credit balance:', error);
        throw error;
    }
}

/**
 * Get signer instance (for owner wallet)
 */
function getSigner(): ethers.Wallet {
    const privateKey = process.env.OWNER_PRIVATE_KEY || process.env.SERVER_PRIVATE_KEY;
    if (!privateKey) {
        throw new Error('OWNER_PRIVATE_KEY or SERVER_PRIVATE_KEY environment variable is required for credit deduction');
    }
    return new ethers.Wallet(privateKey, getProvider());
}

/**
 * Get StorageCreditPool contract instance with signer (for write operations)
 */
function getStorageCreditPoolContractWithSigner(): ethers.Contract {
    const abi = loadContractABI(BLOCKCHAIN_CONFIG.abiPaths.storageCreditPool);
    const address = BLOCKCHAIN_CONFIG.contracts.storageCreditPool;

    if (!address) {
        throw new Error('StorageCreditPool contract address not configured');
    }

    const signer = getSigner();
    return new ethers.Contract(address, abi, signer);
}

/**
 * Deduct credit from on-chain contract (owner only)
 * @param walletId Wallet address to deduct from
 * @param amount Amount to deduct (in token units, e.g., USDC with 6 decimals)
 */
export async function deductCreditFromChain(
    walletId: string,
    amount: bigint
): Promise<{ success: boolean; txHash?: string; error?: string }> {
    try {
        const contract = getStorageCreditPoolContractWithSigner();

        // Empty signature for now (signature parameter is not used in current contract)
        const emptySignature = '0x';

        // Call deductCredit function
        const tx = await contract.deductCredit(walletId, amount, emptySignature);

        console.log(`Credit deduction transaction sent: ${tx.hash} for wallet ${walletId}, amount: ${amount.toString()}`);

        // Wait for transaction to be mined
        const receipt = await tx.wait();

        if (receipt.status === 1) {
            console.log(`Credit deducted successfully: ${tx.hash}`);
            return { success: true, txHash: tx.hash };
        } else {
            return { success: false, error: 'Transaction failed' };
        }
    } catch (error: any) {
        // Handle RPC restrictions
        if (error?.info?.responseStatus === 403 || error?.shortMessage?.includes('403')) {
            console.debug(`RPC restricted for credit deduction: ${walletId}`);
            throw new Error('RPC_METHOD_RESTRICTED');
        }

        // Handle insufficient balance or other contract errors
        if (error?.message?.includes('insufficient balance') || error?.revert?.reason?.includes('insufficient')) {
            console.error(`Insufficient balance for credit deduction: ${walletId}, amount: ${amount.toString()}`);
            return { success: false, error: 'Insufficient balance' };
        }

        console.error('Error deducting credit from chain:', error);
        return { success: false, error: error?.message || 'Unknown error' };
    }
}

