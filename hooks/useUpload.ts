"use client";

import { useState } from "react";
import { uploadFile, UploadResponse } from "@/lib/api";
import { useAppDispatch } from "@/lib/hooks";
import { pushToast, setLoading } from "@/slices/uiSlice";
import { useWallet } from "./useWallet";

type UploadState = {
  progress: number;
  result?: UploadResponse;
  error?: string;
};

export function useUpload() {
  const dispatch = useAppDispatch();
  const { ready } = useWallet();
  const [state, setState] = useState<UploadState>({ progress: 0 });
  const [isUploading, setIsUploading] = useState(false);

  const startUpload = async (file: File) => {
    if (!ready) {
      dispatch(
        pushToast({
          message: "지갑 연결 및 네트워크 전환이 필요합니다.",
        })
      );
      return;
    }
    setIsUploading(true);
    setState({ progress: 5 });
    dispatch(setLoading("업로드 중..."));
    try {
      // NOTE: fetch는 진행률을 알 수 없으므로 간단한 단계적 업데이트만 함.
      setState((prev) => ({ ...prev, progress: 35 }));
      const result = await uploadFile(file);
      setState({ progress: 100, result });
      dispatch(
        pushToast({
          message: "업로드 완료",
          type: "success",
        })
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "업로드에 실패했습니다.";
      setState({ progress: 0, error: message });
      dispatch(
        pushToast({
          message,
          type: "error",
        })
      );
    } finally {
      setIsUploading(false);
      dispatch(setLoading(undefined));
    }
  };

  return {
    ...state,
    isUploading,
    startUpload,
  };
}
