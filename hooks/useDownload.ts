"use client";

import { downloadFile, PaymentRequiredError } from "@/lib/api";
import { useAppDispatch } from "@/lib/hooks";
import { PaymentMessage } from "@/lib/types/x402";
import { pushToast, setLoading } from "@/slices/uiSlice";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { useSignTypedData } from "wagmi";
import { useWallet } from "./useWallet";

export function useDownload() {
    const { ready, address } = useWallet();
    const dispatch = useAppDispatch();
    const queryClient = useQueryClient();
    const [isDownloading, setIsDownloading] = useState(false);
    const [isSigning, setIsSigning] = useState(false);
    const [error, setError] = useState<string>();
    const [downloadUrl, setDownloadUrl] = useState<string>();
    const [currentFileId, setCurrentFileId] = useState<string>();
    const [x402Info, setX402Info] = useState<{
        amount?: string;
        address?: string;
        token?: string;
        nonce?: string;
        chainId?: string;
    }>();

    const { signTypedDataAsync } = useSignTypedData();

    const startDownload = useCallback(
        async (fileId: string, paymentSignature?: string, paymentNonce?: string, paymentTimestamp?: number) => {
            if (!fileId) {
                setError("file_id를 입력하세요.");
                return;
            }
            if (!ready || !address) {
                dispatch(
                    pushToast({
                        message: "지갑 연결 및 네트워크 전환이 필요합니다.",
                        type: "error",
                    })
                );
                return;
            }
            setIsDownloading(true);
            setError(undefined);
            setX402Info(undefined);
            dispatch(setLoading("다운로드 준비 중..."));
            try {
                const { blob, filename } = await downloadFile(fileId, address, paymentSignature, paymentNonce, paymentTimestamp);

                // Create object URL and trigger download
                const url = URL.createObjectURL(blob);

                // Automatically trigger download
                const link = document.createElement('a');
                link.href = url;
                link.download = filename || fileId; // Use filename from header or fallback to fileId
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                // Clean up the object URL after a short delay
                setTimeout(() => {
                    URL.revokeObjectURL(url);
                    setDownloadUrl(undefined);
                }, 100);

                setX402Info(undefined);

                // 다운로드 성공 후 잔액 쿼리 무효화하여 자동으로 다시 조회
                if (address) {
                    queryClient.invalidateQueries({ queryKey: ["balance", address] });
                }

                dispatch(
                    pushToast({
                        message: "파일 다운로드가 시작되었습니다.",
                        type: "success",
                    })
                );
            } catch (err) {
                if (err instanceof PaymentRequiredError) {
                    setCurrentFileId(fileId);
                    setX402Info({
                        amount: err.amount,
                        address: err.address,
                        token: err.token,
                        nonce: err.nonce,
                        chainId: err.chainId,
                    });
                    dispatch(
                        pushToast({
                            message: "잔액 부족 - x402 결제가 필요합니다.",
                            type: "info",
                        })
                    );
                } else {
                    const msg =
                        err instanceof Error ? err.message : "다운로드 중 오류가 발생했습니다.";
                    setError(msg);
                    dispatch(
                        pushToast({
                            message: msg,
                            type: "error",
                        })
                    );
                }
            } finally {
                setIsDownloading(false);
                dispatch(setLoading(undefined));
            }
        },
        [ready, address, dispatch, queryClient]
    );

    const processPayment = useCallback(async () => {
        if (!x402Info || !currentFileId || !address || !ready) {
            dispatch(
                pushToast({
                    message: "결제 정보가 없습니다.",
                    type: "error",
                })
            );
            return;
        }

        if (!x402Info.nonce || !x402Info.amount) {
            dispatch(
                pushToast({
                    message: "결제 정보가 불완전합니다.",
                    type: "error",
                })
            );
            return;
        }

        setIsSigning(true);
        dispatch(setLoading("결제 서명 중..."));

        try {
            const domain = {
                name: "Nano Storage",
                version: "1",
                chainId: parseInt(x402Info.chainId || "10143"), // Monad testnet default
                verifyingContract: x402Info.address as `0x${string}`,
            };

            const types = {
                Payment: [
                    { name: "fileId", type: "string" },
                    { name: "amount", type: "uint256" },
                    { name: "nonce", type: "string" },
                    { name: "timestamp", type: "uint256" },
                ],
            };

            const timestamp = Date.now();
            // USDC uses 6 decimals
            const amountInUnits = BigInt(Math.floor(parseFloat(x402Info.amount) * 1e6));

            const message: PaymentMessage = {
                fileId: currentFileId,
                amount: parseFloat(x402Info.amount),
                nonce: x402Info.nonce,
                timestamp,
            };

            const signature = await signTypedDataAsync({
                domain,
                types,
                primaryType: "Payment",
                message: {
                    fileId: message.fileId,
                    amount: amountInUnits,
                    nonce: message.nonce,
                    timestamp: BigInt(message.timestamp),
                },
            });

            dispatch(
                pushToast({
                    message: "서명 완료. 다운로드를 재시도합니다.",
                    type: "success",
                })
            );

            // 서명과 함께 재다운로드
            await startDownload(currentFileId, signature, x402Info.nonce, timestamp);
        } catch (err) {
            const msg = err instanceof Error ? err.message : "서명 중 오류가 발생했습니다.";
            setError(msg);
            dispatch(
                pushToast({
                    message: msg,
                    type: "error",
                })
            );
        } finally {
            setIsSigning(false);
            dispatch(setLoading(undefined));
        }
    }, [x402Info, currentFileId, address, ready, dispatch, signTypedDataAsync, startDownload]);

    return useMemo(
        () => ({
            isDownloading,
            isSigning,
            startDownload,
            processPayment,
            downloadUrl,
            error,
            x402Info,
        }),
        [isDownloading, isSigning, startDownload, processPayment, downloadUrl, error, x402Info]
    );
}
