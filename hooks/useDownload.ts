"use client";

import { useState } from "react";
import { downloadFile, PaymentRequiredError } from "@/lib/api";
import { useWallet } from "./useWallet";
import { useAppDispatch } from "@/lib/hooks";
import { pushToast, setLoading } from "@/slices/uiSlice";

export function useDownload() {
  const { ready } = useWallet();
  const dispatch = useAppDispatch();
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string>();
  const [downloadUrl, setDownloadUrl] = useState<string>();
  const [x402Info, setX402Info] = useState<{
    amount?: string;
    address?: string;
    token?: string;
    nonce?: string;
    chainId?: string;
  }>();

  const startDownload = async (fileId: string) => {
    if (!fileId) {
      setError("file_id를 입력하세요.");
      return;
    }
    if (!ready) {
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
      const blob = await downloadFile(fileId);
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      dispatch(
        pushToast({
          message: "다운로드 링크가 준비되었습니다.",
          type: "success",
        })
      );
    } catch (err) {
      if (err instanceof PaymentRequiredError) {
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
  };

  return {
    isDownloading,
    startDownload,
    downloadUrl,
    error,
    x402Info,
  };
}
