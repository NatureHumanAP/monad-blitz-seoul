"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWallet } from "@/hooks/useWallet";

export function Header() {
  const {
    shortAddress,
    isConnected,
    requiresSwitch,
    switchToMonad,
    isSwitching,
    connectorName,
    status,
  } = useWallet();

  return (
    <div className="flex w-full items-center justify-between rounded-2xl border border-zinc-200 bg-white/70 px-5 py-3 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="space-y-1">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Nano Storage dApp
        </p>
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          {isConnected
            ? `연결됨: ${shortAddress} (${connectorName ?? "connector"})`
            : "지갑을 연결하고 시작하세요."}
        </p>
        {!isConnected ? (
          <p className="text-[11px] text-zinc-500 dark:text-zinc-500">
            RainbowKit 버튼으로 연결하세요. 상태: {status}
          </p>
        ) : null}
        {requiresSwitch ? (
          <button
            onClick={switchToMonad}
            disabled={isSwitching}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500/80 px-3 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:opacity-60"
            type="button"
          >
            {isSwitching ? "네트워크 전환 중..." : "Monad 네트워크로 전환"}
          </button>
        ) : null}
      </div>
      <ConnectButton />
    </div>
  );
}
