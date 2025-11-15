"use client";

import { useDownload } from "@/hooks/useDownload";
import { useFileList } from "@/hooks/useFileList";
import { useWallet } from "@/hooks/useWallet";
import { FileListItem } from "@/lib/api";
import { useAppDispatch } from "@/lib/hooks";
import { pushToast } from "@/slices/uiSlice";
import { useState } from "react";
import { SectionCard } from "./SectionCard";

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function getStorageStatusLabel(status: FileListItem["storageStatus"]): string {
    switch (status) {
        case "free_storage":
            return "무료 보관";
        case "prepaid_storage":
            return "유료 보관";
        case "locked":
            return "잠금";
        case "expired":
            return "만료";
        default:
            return status;
    }
}

function getStorageStatusColor(status: FileListItem["storageStatus"]): string {
    switch (status) {
        case "free_storage":
            return "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-100";
        case "prepaid_storage":
            return "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-100";
        case "locked":
            return "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-100";
        case "expired":
            return "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-100";
        default:
            return "bg-zinc-50 text-zinc-700 dark:bg-zinc-900/30 dark:text-zinc-100";
    }
}

export function FileListSection() {
    const { ready, requiresSwitch } = useWallet();
    const { files, isLoading, error, refreshFiles } = useFileList();
    const { startDownload, isDownloading, isSigning, processPayment, error: downloadError, x402Info, currentFileId } = useDownload();
    const dispatch = useAppDispatch();
    const [copiedFileId, setCopiedFileId] = useState<string | null>(null);

    const handleCopyFileId = async (fileId: string) => {
        try {
            await navigator.clipboard.writeText(fileId);
            setCopiedFileId(fileId);
            dispatch(
                pushToast({
                    message: "파일 ID가 복사되었습니다.",
                    type: "success",
                })
            );
            setTimeout(() => setCopiedFileId(null), 2000);
        } catch (err) {
            dispatch(
                pushToast({
                    message: "복사에 실패했습니다.",
                    type: "error",
                })
            );
        }
    };

    return (
        <SectionCard
            title="내 파일 목록"
            description="업로드한 파일들을 확인하고 관리할 수 있습니다."
            disabled={!ready}
            action={
                <div className="flex items-center gap-2">
                    <button
                        onClick={refreshFiles}
                        disabled={!ready || isLoading}
                        className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                        type="button"
                    >
                        {isLoading ? "로딩 중..." : "새로고침"}
                    </button>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                        {ready ? "지갑 연결됨" : requiresSwitch ? "네트워크 전환 필요" : "연결 필요"}
                    </span>
                </div>
            }
        >
            {!ready ? (
                <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    지갑을 연결하면 업로드한 파일 목록을 볼 수 있습니다.
                </div>
            ) : isLoading ? (
                <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    파일 목록을 불러오는 중...
                </div>
            ) : error ? (
                <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-100">
                    {error}
                </div>
            ) : files.length === 0 ? (
                <div className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    업로드한 파일이 없습니다.
                </div>
            ) : (
                <div className="space-y-3">
                    {files.map((file) => (
                        <div
                            key={file.fileId}
                            className="rounded-lg border border-zinc-200 bg-white/70 p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-800/70"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <h3 className="truncate font-medium text-zinc-900 dark:text-zinc-50">
                                            {file.fileName}
                                        </h3>
                                        <span
                                            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${getStorageStatusColor(file.storageStatus)}`}
                                        >
                                            {getStorageStatusLabel(file.storageStatus)}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                                        <div className="flex items-center gap-2">
                                            <span>파일 ID: {file.fileId.slice(0, 16)}...</span>
                                            <button
                                                onClick={() => handleCopyFileId(file.fileId)}
                                                className="rounded px-1.5 py-0.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                                                type="button"
                                                title="파일 ID 복사"
                                            >
                                                {copiedFileId === file.fileId ? "복사됨!" : "복사"}
                                            </button>
                                        </div>
                                        <span>크기: {formatFileSize(file.fileSize)}</span>
                                        <span>업로드: {formatDate(file.uploadDate)}</span>
                                    </div>
                                    <div className="space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                                        {file.storageStatus === "free_storage" && (
                                            <>
                                                {file.estimatedDeletionDate && (
                                                    <div>
                                                        예상 삭제일: {formatDate(file.estimatedDeletionDate)}
                                                        {file.daysUntilDeletion !== undefined && (
                                                            <span> ({file.daysUntilDeletion}일 후)</span>
                                                        )}
                                                    </div>
                                                )}
                                                <div>
                                                    일일 보관료: ${file.dailyStorageFee.toFixed(4)} / 월간 보관료: $
                                                    {file.monthlyStorageFee.toFixed(4)}
                                                </div>
                                            </>
                                        )}
                                        {file.storageStatus === "prepaid_storage" && (
                                            <>
                                                {file.creditBalance !== undefined && (
                                                    <div>크레딧 잔액: ${file.creditBalance.toFixed(4)}</div>
                                                )}
                                                {file.daysCovered !== undefined && (
                                                    <div>예상 보관 기간: {file.daysCovered}일</div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => startDownload(file.fileId)}
                                    disabled={!ready || isDownloading}
                                    className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600"
                                    type="button"
                                >
                                    {isDownloading && currentFileId === file.fileId ? "다운로드 중..." : "다운로드"}
                                </button>
                            </div>
                            {downloadError && currentFileId === file.fileId && (
                                <div className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-100">
                                    {downloadError}
                                </div>
                            )}
                            {x402Info && currentFileId === file.fileId && (
                                <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                                    <div className="font-semibold">x402 결제 필요</div>
                                    <div className="mt-1 space-y-1">
                                        <div>필요 금액: {x402Info.amount ?? "알 수 없음"}</div>
                                        <div>결제 주소: {x402Info.address ?? "알 수 없음"}</div>
                                        <div>Nonce: {x402Info.nonce ?? "알 수 없음"}</div>
                                    </div>
                                    <button
                                        className="mt-2 w-full rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                                        type="button"
                                        disabled={!ready || isSigning || isDownloading}
                                        onClick={processPayment}
                                    >
                                        {isSigning ? "서명 중..." : "EIP-712 서명으로 결제"}
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </SectionCard>
    );
}

