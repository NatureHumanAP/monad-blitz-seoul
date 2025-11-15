"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { fetchFileList, FileListResponse } from "@/lib/api";
import { useAppDispatch } from "@/lib/hooks";
import { pushToast, setLoading } from "@/slices/uiSlice";
import { useWallet } from "./useWallet";

export function useFileList() {
  const dispatch = useAppDispatch();
  const { ready, address } = useWallet();
  const [files, setFiles] = useState<FileListResponse["files"]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshFiles = useCallback(async () => {
    if (!ready || !address) {
      setFiles([]);
      return;
    }

    setIsLoading(true);
    setError(null);
    dispatch(setLoading("파일 목록 불러오는 중..."));

    try {
      const response = await fetchFileList(address);
      setFiles(response.files);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "파일 목록을 불러오는데 실패했습니다.";
      setError(message);
      dispatch(
        pushToast({
          message,
          type: "error",
        })
      );
    } finally {
      setIsLoading(false);
      dispatch(setLoading(undefined));
    }
  }, [ready, address, dispatch]);

  // 자동으로 파일 목록 로드
  useEffect(() => {
    if (ready && address) {
      refreshFiles();
    } else {
      setFiles([]);
      setError(null);
    }
  }, [ready, address, refreshFiles]);

  return useMemo(
    () => ({
      files,
      isLoading,
      error,
      refreshFiles,
    }),
    [files, isLoading, error, refreshFiles]
  );
}

