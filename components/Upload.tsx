"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useUpload } from "@/hooks/useUpload";
import { SectionCard } from "./SectionCard";

export function UploadSection() {
  const { ready, requiresSwitch } = useWallet();
  const { isUploading, progress, result, error, startUpload } = useUpload();
  const [fileName, setFileName] = useState<string>();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  return (
    <SectionCard
      title="파일 업로드"
      description="업로드 후 서버가 반환한 file_id와 다운로드 URL을 표시할 예정입니다."
      disabled={!ready}
      action={
        <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
          {ready ? "지갑 연결됨" : requiresSwitch ? "네트워크 전환 필요" : "연결 필요"}
        </span>
      }
    >
      <label className="flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 transition hover:border-zinc-400 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:border-zinc-500 dark:hover:bg-zinc-800">
        <input
          type="file"
          className="hidden"
          disabled={!ready}
          onChange={(e) => {
            const file = e.target.files?.[0];
            setSelectedFile(file || null);
            setFileName(file?.name);
          }}
        />
        <span className="font-medium">파일 선택 또는 드래그앤드롭</span>
        <span className="text-xs text-zinc-500">
          용량/MIME 검증 · 진행률 표시를 여기에 붙일 예정
        </span>
      </label>
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        {fileName ? (
          <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2 shadow-sm dark:bg-zinc-800/70">
            <span className="font-medium">{fileName}</span>
            <button
              className="text-xs font-semibold text-blue-600 hover:underline"
              type="button"
              disabled={!ready || !selectedFile || isUploading}
              onClick={() => selectedFile && startUpload(selectedFile)}
            >
              업로드 시작
            </button>
          </div>
        ) : (
          "업로드할 파일을 선택하세요."
        )}
      </div>
      {isUploading ? (
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          업로드 중... {progress}%
        </div>
      ) : null}
      {result ? (
        <div className="space-y-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 shadow-sm dark:bg-emerald-900/30 dark:text-emerald-100">
          <div>업로드 완료: file_id={result.fileId}</div>
          <div className="flex items-center gap-2">
            <span className="underline">{result.downloadUrl}</span>
            <button
              type="button"
              className="text-xs font-semibold text-blue-700 hover:underline"
              onClick={() => navigator.clipboard?.writeText(result.downloadUrl)}
            >
              복사
            </button>
          </div>
          {result.storageInfo ? (
            <div className="rounded-md bg-white/70 px-2 py-2 text-xs text-emerald-800 dark:bg-emerald-800/50 dark:text-emerald-50">
              <div>보관 안내: {result.storageInfo.message}</div>
              <div>예상 삭제일: {result.storageInfo.estimatedDeletionDate}</div>
              <div>남은 무료 일수: {result.storageInfo.daysUntilDeletion}일</div>
              <div>
                일/월 보관료 예상: $
                {result.storageInfo.dailyStorageFee ?? 0} / $
                {result.storageInfo.monthlyStorageFee ?? 0}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {error ? (
        <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
      ) : null}
    </SectionCard>
  );
}
