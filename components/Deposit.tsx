"use client";

import { useState } from "react";
import { useWallet } from "@/hooks/useWallet";
import { useBalance } from "@/hooks/useBalance";
import { useDeposit } from "@/hooks/useDeposit";
import { SectionCard } from "./SectionCard";

const presets = [0.1, 0.25, 0.5];

export function DepositSection() {
  const { ready, requiresSwitch } = useWallet();
  const { balance, isLoading: isBalanceLoading, refresh } = useBalance();
  const { deposit, isDepositing } = useDeposit();
  const [amount, setAmount] = useState<number>(presets[0]);

  return (
    <SectionCard
      title="크레딧 충전"
      description="컨트랙트 deposit 호출과 잔액 새로고침을 연결합니다."
      disabled={!ready}
      action={
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {ready ? "지갑 연결됨" : requiresSwitch ? "네트워크 전환 필요" : "연결 필요"}
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={!ready || isBalanceLoading}
            className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-60"
          >
            {isBalanceLoading ? "조회 중..." : "잔액 새로고침"}
          </button>
        </div>
      }
    >
      <div className="text-sm text-zinc-600 dark:text-zinc-300">
        현재 크레딧:{" "}
        {isBalanceLoading
          ? "조회 중..."
          : balance !== undefined
            ? `${balance} MON`
            : "지갑 연결 후 조회"}
      </div>
      <div className="flex flex-wrap gap-2">
        {presets.map((value) => (
          <button
            key={value}
            type="button"
            disabled={!ready}
            onClick={() => setAmount(value)}
            className={`rounded-full border px-3 py-1 text-sm font-semibold transition ${
              amount === value
                ? "border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-100"
                : "border-zinc-300 text-zinc-700 hover:border-zinc-400 dark:border-zinc-700 dark:text-zinc-200 dark:hover:border-zinc-500"
            } disabled:cursor-not-allowed disabled:opacity-60`}
          >
            {value} MON
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <input
          type="number"
          step="0.01"
          min="0"
          value={amount}
          disabled={!ready}
          onChange={(e) => setAmount(parseFloat(e.target.value))}
          className="w-40 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-blue-400 dark:focus:ring-blue-800/30"
        />
        <button
          type="button"
          disabled={!ready}
          onClick={() => deposit(amount)}
          className="inline-flex items-center justify-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"
        >
          {isDepositing ? "진행 중..." : "Deposit 실행"}
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        추후 `lib/contract.ts`와 `hooks/useBalance`를 연결해 트랜잭션 상태와
        잔액을 갱신합니다.
      </p>
    </SectionCard>
  );
}
