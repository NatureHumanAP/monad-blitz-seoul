"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  useAccount,
  useChainId,
  useChains,
  useConnect,
  useDisconnect,
  useSwitchChain,
} from "wagmi";
import { monadTestnet } from "@/lib/wallet";
import { useAppDispatch } from "@/lib/hooks";
import { pushToast } from "@/slices/uiSlice";

const TARGET_CHAIN = monadTestnet.id;

export function useWallet() {
  const dispatch = useAppDispatch();
  const { address, isConnected, isConnecting, status, connector } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const { connect, connectors, error: connectError } = useConnect();
  const { disconnect } = useDisconnect();
  const {
    switchChain,
    isPending: isSwitching,
    error: switchError,
  } = useSwitchChain();

  const requiresSwitch = isConnected && chainId !== TARGET_CHAIN;
  const ready = isConnected && !requiresSwitch;

  // Try auto-switch when we can.
  const attemptedSwitchRef = useRef(false);
  useEffect(() => {
    if (!requiresSwitch || !switchChain || attemptedSwitchRef.current) return;
    const hasTarget = chains.some((c) => c.id === TARGET_CHAIN);
    if (hasTarget) {
      try {
        const result = switchChain({ chainId: TARGET_CHAIN });
        Promise.resolve(result).catch(() => {
          // ignore, user can click button
        });
      } catch {
        // ignore, user can click button manually
      }
      attemptedSwitchRef.current = true;
    } else {
      dispatch(
        pushToast({
          id: "network-missing",
          message: "Monad 네트워크가 RainbowKit 설정에 없습니다.",
          type: "error",
        })
      );
    }
  }, [requiresSwitch, switchChain, chains, dispatch]);

  // Surface errors as toasts.
  useEffect(() => {
    if (connectError) {
      dispatch(
        pushToast({
          id: "connect-error",
          message: connectError.message,
          type: "error",
        })
      );
    }
  }, [connectError, dispatch]);

  useEffect(() => {
    if (switchError) {
      dispatch(
        pushToast({
          id: "switch-error",
          message: switchError.message,
          type: "error",
        })
      );
    }
  }, [switchError, dispatch]);

  const primaryConnector = connectors[0];

  const connectWallet = () => {
    if (!primaryConnector) {
      dispatch(
        pushToast({
          id: "no-connector",
          message: "사용 가능한 지갑 커넥터가 없습니다.",
          type: "error",
        })
      );
      return;
    }
    connect({ connector: primaryConnector });
  };

  const switchToMonad = () =>
    switchChain ? switchChain({ chainId: TARGET_CHAIN }) : undefined;

  const shortAddress = useMemo(() => {
    if (!address) return "";
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }, [address]);

  return {
    address,
    shortAddress,
    isConnected,
    isConnecting,
    requiresSwitch,
    ready,
    connectWallet,
    disconnect,
    switchToMonad,
    isSwitching,
    status,
    connectorName: connector?.name,
  };
}
