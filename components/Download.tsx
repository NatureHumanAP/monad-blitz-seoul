"use client";

import { useDownload } from "@/hooks/useDownload";
import { useWallet } from "@/hooks/useWallet";
import { useState } from "react";
import { SectionCard } from "./SectionCard";

export function DownloadSection() {
    const { ready, requiresSwitch } = useWallet();
    const { startDownload, isDownloading, isSigning, processPayment, downloadUrl, error, x402Info } =
        useDownload();
    const [fileId, setFileId] = useState<string>("");
    return (
        <SectionCard
            title="파일 다운로드"
            description="x402 결제/서명 후 다운로드를 트리거합니다."
            disabled={!ready}
            action={
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                    {ready ? "지갑 연결됨" : requiresSwitch ? "네트워크 전환 필요" : "연결 필요"}
                </span>
            }
        >
            <div className="flex flex-col gap-3">
                <input
                    type="text"
                    placeholder="file_id 또는 다운로드 토큰"
                    disabled={!ready}
                    value={fileId}
                    onChange={(e) => setFileId(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:focus:ring-blue-800/30"
                />
                <button
                    className="inline-flex w-fit items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                    type="button"
                    disabled={!ready || !fileId || isDownloading}
                    onClick={() => startDownload(fileId)}
                >
                    {isDownloading ? "다운로드 중..." : "결제/서명 후 다운로드"}
                </button>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    다운로드 전 잔액 조회, x402 챌린지 파싱, 결제/서명 플로우를 여기에
                    연결합니다.
                </p>
                {error ? (
                    <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
                ) : null}
                {x402Info ? (
                    <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-700 dark:bg-amber-900/30 dark:text-amber-100">
                        <div className="font-semibold">x402 결제 정보</div>
                        <ul className="mt-1 space-y-1">
                            <li>필요 금액: {x402Info.amount ?? "알 수 없음"}</li>
                            <li>결제 주소: {x402Info.address ?? "알 수 없음"}</li>
                            <li>토큰 주소: {x402Info.token ?? "알 수 없음"}</li>
                            <li>Nonce: {x402Info.nonce ?? "알 수 없음"}</li>
                            <li>Chain ID: {x402Info.chainId ?? "알 수 없음"}</li>
                        </ul>
                        <p className="mt-2 mb-2">
                            크레딧이 부족하여 402로 전환되었습니다. EIP-712 서명으로 결제하세요.
                        </p>
                        <button
                            className="inline-flex w-full items-center justify-center rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-amber-300"
                            type="button"
                            disabled={!ready || isSigning || isDownloading}
                            onClick={processPayment}
                        >
                            {isSigning ? "서명 중..." : "EIP-712 서명으로 결제"}
                        </button>
                    </div>
                ) : null}
            </div>
        </SectionCard>
    );
}
