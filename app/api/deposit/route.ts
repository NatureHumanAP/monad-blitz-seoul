import { BLOCKCHAIN_CONFIG } from '@/config/blockchain';
import { getProvider, getStorageCreditPoolContract } from '@/services/blockchain';
import { updateCreditBalance } from '@/services/credit';
import { ethers } from 'ethers';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        let { walletId, txHash, amount } = body;

        if (!walletId) {
            return NextResponse.json(
                { error: 'walletId is required' },
                { status: 400 }
            );
        }

        // Normalize walletId to lowercase (consistent with storage)
        walletId = walletId.toLowerCase();

        if (!txHash) {
            return NextResponse.json(
                {
                    error: 'txHash is required',
                    message: '트랜잭션 해시가 필요합니다. 온체인 deposit 트랜잭션을 먼저 실행한 후 트랜잭션 해시를 제공해주세요.'
                },
                { status: 400 }
            );
        }

        // If amount is provided, use it directly (client already verified transaction)
        // Otherwise, try to fetch from blockchain (may fail due to RPC restrictions)
        let depositAmount: bigint | null = null;

        if (amount !== undefined && typeof amount === 'number' && amount > 0) {
            // Use amount from client (client already verified the transaction)
            // Convert from human readable to token units (USDC uses 6 decimals)
            const { parseUnits } = await import('ethers');
            depositAmount = parseUnits(amount.toString(), 6);
            console.log(`Using provided amount: ${amount} USDC = ${depositAmount} units`);
        } else {
            // Fallback: Try to verify from blockchain (may fail due to RPC restrictions)
            const provider = getProvider();
            let receipt;

            try {
                // Try to get transaction receipt directly (avoids restricted methods)
                receipt = await provider.getTransactionReceipt(txHash);

                // If receipt is null, transaction might be pending or not mined yet
                if (!receipt) {
                    return NextResponse.json(
                        {
                            error: 'Transaction not found or still pending',
                            message: '트랜잭션이 아직 확인되지 않았습니다. amount 파라미터를 포함해서 다시 시도해주세요.'
                        },
                        { status: 400 }
                    );
                }

                if (receipt.status !== 1) {
                    return NextResponse.json(
                        { error: 'Transaction failed', message: '트랜잭션이 실패했습니다.' },
                        { status: 400 }
                    );
                }

                // Verify transaction is to StorageCreditPool contract
                const storageCreditPoolAddress = BLOCKCHAIN_CONFIG.contracts.storageCreditPool.toLowerCase();
                if (receipt.to?.toLowerCase() !== storageCreditPoolAddress) {
                    return NextResponse.json(
                        { error: 'Transaction is not to StorageCreditPool contract' },
                        { status: 400 }
                    );
                }

                // Parse CreditDeposited event from receipt
                const contract = getStorageCreditPoolContract();
                const iface = contract.interface;

                // Find CreditDeposited event in logs
                let eventWalletId: string | null = null;

                for (const log of receipt.logs) {
                    try {
                        const parsedLog = iface.parseLog({
                            topics: log.topics as string[],
                            data: log.data,
                        });

                        if (parsedLog && parsedLog.name === 'CreditDeposited') {
                            eventWalletId = parsedLog.args[0] as string;
                            depositAmount = parsedLog.args[1] as bigint;
                            break;
                        }
                    } catch (error) {
                        // Not a CreditDeposited event, continue
                        continue;
                    }
                }

                if (!depositAmount || !eventWalletId) {
                    return NextResponse.json(
                        { error: 'CreditDeposited event not found in transaction' },
                        { status: 400 }
                    );
                }

                // Verify wallet ID matches
                if (eventWalletId.toLowerCase() !== walletId.toLowerCase()) {
                    return NextResponse.json(
                        { error: 'Wallet ID mismatch' },
                        { status: 400 }
                    );
                }
            } catch (rpcError: any) {
                // Handle RPC restrictions or other errors
                console.error('RPC error while fetching transaction receipt:', rpcError);

                // If it's a restricted method error, ask for amount parameter
                if (rpcError?.info?.responseStatus === 403 || rpcError?.shortMessage?.includes('403')) {
                    return NextResponse.json(
                        {
                            error: 'RPC method restricted',
                            message: 'RPC 제한으로 트랜잭션을 확인할 수 없습니다. amount 파라미터를 포함해서 다시 요청해주세요.',
                            details: '요청 예시: { "walletId": "...", "txHash": "...", "amount": 1.0 }'
                        },
                        { status: 400 } // Bad Request (missing required parameter)
                    );
                }

                // Re-throw other errors
                throw rpcError;
            }
        }

        if (!depositAmount) {
            return NextResponse.json(
                { error: 'Deposit amount could not be determined' },
                { status: 400 }
            );
        }

        // Update credit balance
        console.log(`Updating credit balance for wallet ${walletId}, amount: ${depositAmount.toString()} (${Number(ethers.formatUnits(depositAmount, 6))} USDC)`);
        await updateCreditBalance(walletId, depositAmount);

        // Verify and sync with on-chain balance (if RPC is available)
        try {
            const { getOnChainCreditBalance } = await import('@/services/blockchain');
            const { syncCreditBalanceFromChain } = await import('@/services/credit');
            
            // Try to sync with on-chain balance (may fail due to RPC restrictions)
            await syncCreditBalanceFromChain(walletId);
        } catch (syncError: any) {
            // Silently handle RPC restrictions - this is expected
            if (syncError?.message !== 'RPC_METHOD_RESTRICTED') {
                console.warn(`Failed to sync with on-chain balance for wallet ${walletId}:`, syncError?.message || syncError);
            }
        }

        // Get updated balance (from local storage, synced if possible)
        const { getCreditBalance } = await import('@/services/credit');
        const balance = await getCreditBalance(walletId);
        console.log(`Final balance for wallet ${walletId}: ${balance} USDC`);

        return NextResponse.json({
            txId: txHash,
            balance,
            message: 'Deposit processed successfully',
        });
    } catch (error: any) {
        console.error('Deposit error:', error);
        return NextResponse.json(
            { error: 'Failed to process deposit', details: error.message },
            { status: 500 }
        );
    }
}

