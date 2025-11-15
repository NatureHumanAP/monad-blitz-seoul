"use client";

import { BLOCKCHAIN_CONFIG_CLIENT } from "@/config/blockchain.client";
import { depositCredits } from "@/lib/api";
import { useAppDispatch } from "@/lib/hooks";
import { pushToast, setLoading } from "@/slices/uiSlice";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatUnits, maxUint256, parseUnits } from "viem";
import { useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { useWallet } from "./useWallet";

// USDC uses 6 decimals
const TOKEN_DECIMALS = 6;

// ERC20 ABI (approve and allowance functions)
const ERC20_ABI = [
    {
        inputs: [
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "approve",
        outputs: [
            {
                internalType: "bool",
                name: "",
                type: "bool",
            },
        ],
        stateMutability: "nonpayable",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "owner",
                type: "address",
            },
            {
                internalType: "address",
                name: "spender",
                type: "address",
            },
        ],
        name: "allowance",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "address",
                name: "account",
                type: "address",
            },
        ],
        name: "balanceOf",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
] as const;

// StorageCreditPool ABI (deposit function only)
const STORAGE_CREDIT_POOL_ABI = [
    {
        inputs: [
            {
                internalType: "uint256",
                name: "amount",
                type: "uint256",
            },
        ],
        name: "deposit",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
    },
] as const;

export function useDeposit() {
    const { address, ready } = useWallet();
    const dispatch = useAppDispatch();
    const queryClient = useQueryClient();
    const [isDepositing, setIsDepositing] = useState(false);

    const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();

    const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
        hash,
    });

    // Read current allowance (with error handling for restricted RPC methods)
    const { data: currentAllowance, error: allowanceError } = useReadContract({
        address: BLOCKCHAIN_CONFIG_CLIENT.contracts.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: address && BLOCKCHAIN_CONFIG_CLIENT.contracts.storageCreditPool
            ? [address, BLOCKCHAIN_CONFIG_CLIENT.contracts.storageCreditPool as `0x${string}`]
            : undefined,
        query: {
            enabled: !!address && !!BLOCKCHAIN_CONFIG_CLIENT.contracts.storageCreditPool && ready,
            retry: false, // Don't retry on RPC restrictions
        },
    });

    // Read token balance (with error handling for restricted RPC methods)
    const { data: tokenBalance, error: balanceError } = useReadContract({
        address: BLOCKCHAIN_CONFIG_CLIENT.contracts.paymentToken as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: address ? [address] : undefined,
        query: {
            enabled: !!address && !!BLOCKCHAIN_CONFIG_CLIENT.contracts.paymentToken && ready,
            retry: false, // Don't retry on RPC restrictions
        },
    });

    // Log RPC errors silently (RPC restrictions are common)
    useEffect(() => {
        if (allowanceError || balanceError) {
            // Silently ignore RPC restriction errors - we'll check on transaction time
            console.debug("RPC query error (may be restricted):", allowanceError || balanceError);
        }
    }, [allowanceError, balanceError]);

    const processedHashRef = useRef<string | null>(null);
    const pendingDepositAmountRef = useRef<bigint | null>(null);
    const isApproveTxRef = useRef(false);

    // Handle transaction confirmation
    useEffect(() => {
        if (isConfirmed && hash && hash !== processedHashRef.current && address) {
            processedHashRef.current = hash;

            // If this was an approve transaction, proceed with deposit
            if (isApproveTxRef.current && pendingDepositAmountRef.current) {
                isApproveTxRef.current = false;
                const amountToDeposit = pendingDepositAmountRef.current;
                pendingDepositAmountRef.current = null;

                // Wait a bit for allowance to update, then execute deposit
                setTimeout(() => {
                    dispatch(setLoading("Deposit 트랜잭션 실행 중..."));
                    writeContract({
                        address: BLOCKCHAIN_CONFIG_CLIENT.contracts.storageCreditPool as `0x${string}`,
                        abi: STORAGE_CREDIT_POOL_ABI,
                        functionName: "deposit",
                        args: [amountToDeposit],
                    });
                }, 1000);
                return;
            }

            // Check if this is a deposit transaction (not approve)
            // Determine by checking if it's calling StorageCreditPool deposit
            const storageCreditPoolAddress = BLOCKCHAIN_CONFIG_CLIENT.contracts.storageCreditPool?.toLowerCase();
            if (storageCreditPoolAddress) {
                // Transaction confirmed, notify server (only for deposit transactions)
                // Get the deposit amount from the pending deposit ref if available
                const depositAmount = pendingDepositAmountRef.current
                    ? Number(formatUnits(pendingDepositAmountRef.current, TOKEN_DECIMALS))
                    : undefined;

                depositCredits({ walletId: address, txHash: hash, amount: depositAmount })
                    .then((result) => {
                        dispatch(
                            pushToast({
                                message: result.message || "Deposit 완료",
                                type: "success",
                            })
                        );

                        // Update cache directly with server response balance
                        if (result.balance !== undefined) {
                            queryClient.setQueryData(
                                ["balance", address],
                                { walletId: address, balance: result.balance }
                            );
                        } else {
                            // Fallback: invalidate and refetch
                            queryClient.invalidateQueries({ queryKey: ["balance", address] });
                        }
                    })
                    .catch((err) => {
                        const msg =
                            err instanceof Error ? err.message : "서버에 Deposit 정보를 전달하는 중 오류가 발생했습니다.";
                        dispatch(pushToast({ message: msg, type: "error" }));
                    })
                    .finally(() => {
                        setIsDepositing(false);
                        dispatch(setLoading(undefined));
                        pendingDepositAmountRef.current = null;
                    });
            } else {
                // Approve transaction completed, reset state
                setIsDepositing(false);
                dispatch(setLoading(undefined));
            }
        }
    }, [isConfirmed, hash, address, dispatch, queryClient, writeContract]);

    // Handle write errors
    useEffect(() => {
        if (writeError) {
            dispatch(
                pushToast({
                    message: writeError.message || "Deposit 트랜잭션 실행 중 오류가 발생했습니다.",
                    type: "error",
                })
            );
            setIsDepositing(false);
            dispatch(setLoading(undefined));
        }
    }, [writeError, dispatch]);

    // Update loading state
    useEffect(() => {
        if (isPending || isConfirming) {
            dispatch(setLoading(isPending ? "트랜잭션 전송 중..." : "트랜잭션 확인 중..."));
        }
    }, [isPending, isConfirming, dispatch]);

    const deposit = useCallback(
        async (amount: number) => {
            if (!address) {
                dispatch(
                    pushToast({ message: "지갑을 연결한 뒤 시도하세요.", type: "error" })
                );
                return;
            }
            if (!ready) {
                dispatch(
                    pushToast({
                        message: "Monad 네트워크로 전환 후 진행하세요.",
                        type: "error",
                    })
                );
                return;
            }
            if (amount <= 0) {
                dispatch(
                    pushToast({ message: "0보다 큰 금액을 입력하세요.", type: "error" })
                );
                return;
            }

            if (!BLOCKCHAIN_CONFIG_CLIENT.contracts.storageCreditPool) {
                dispatch(
                    pushToast({
                        message: "StorageCreditPool 컨트랙트 주소가 설정되지 않았습니다.",
                        type: "error",
                    })
                );
                return;
            }

            if (!BLOCKCHAIN_CONFIG_CLIENT.contracts.paymentToken) {
                dispatch(
                    pushToast({
                        message: "결제 토큰 주소가 설정되지 않았습니다.",
                        type: "error",
                    })
                );
                return;
            }

            setIsDepositing(true);
            const amountInUnits = parseUnits(amount.toString(), TOKEN_DECIMALS);

            try {
                const storageCreditPoolAddress = BLOCKCHAIN_CONFIG_CLIENT.contracts.storageCreditPool as `0x${string}`;
                const paymentTokenAddress = BLOCKCHAIN_CONFIG_CLIENT.contracts.paymentToken as `0x${string}`;

                // Check if user has sufficient token balance (only if we have balance data)
                if (tokenBalance !== undefined && !balanceError) {
                    const balance = tokenBalance ?? BigInt(0);
                    if (balance < amountInUnits) {
                        const balanceFormatted = formatUnits(balance, TOKEN_DECIMALS);
                        dispatch(
                            pushToast({
                                message: `토큰 잔액이 부족합니다. (보유: ${balanceFormatted} USDC, 필요: ${amount} USDC)`,
                                type: "error",
                            })
                        );
                        setIsDepositing(false);
                        dispatch(setLoading(undefined));
                        return;
                    }
                }

                // Check if allowance is sufficient (only if we have allowance data)
                // If RPC is restricted, we'll try approve anyway and let the transaction fail if needed
                const allowance = currentAllowance ?? BigInt(0);
                const shouldApprove = allowanceError ? true : allowance < amountInUnits;

                if (shouldApprove) {
                    // Need to approve first
                    dispatch(setLoading("토큰 승인 중..."));

                    // Store deposit amount for later
                    pendingDepositAmountRef.current = amountInUnits;
                    isApproveTxRef.current = true;

                    // Approve max amount to avoid repeated approvals
                    writeContract({
                        address: paymentTokenAddress,
                        abi: ERC20_ABI,
                        functionName: "approve",
                        args: [storageCreditPoolAddress, maxUint256],
                    });
                    return;
                }

                // Allowance is sufficient, proceed with deposit
                dispatch(setLoading("Deposit 트랜잭션 실행 중..."));

                // Store deposit amount for server notification later
                pendingDepositAmountRef.current = amountInUnits;

                writeContract({
                    address: storageCreditPoolAddress,
                    abi: STORAGE_CREDIT_POOL_ABI,
                    functionName: "deposit",
                    args: [amountInUnits],
                });
            } catch (err) {
                const msg =
                    err instanceof Error ? err.message : "트랜잭션 실행 중 오류가 발생했습니다.";
                dispatch(pushToast({ message: msg, type: "error" }));
                setIsDepositing(false);
                dispatch(setLoading(undefined));
            }
        },
        [address, ready, dispatch, writeContract, currentAllowance, tokenBalance]
    );

    const isDepositingState = useMemo(
        () => isDepositing || isPending || isConfirming,
        [isDepositing, isPending, isConfirming]
    );

    return useMemo(
        () => ({
            deposit,
            isDepositing: isDepositingState,
        }),
        [deposit, isDepositingState]
    );
}
