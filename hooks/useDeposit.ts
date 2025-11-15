"use client";

import { useState } from "react";
import { useWallet } from "./useWallet";
import { useAppDispatch } from "@/lib/hooks";
import { pushToast, setLoading } from "@/slices/uiSlice";
import { depositCredits } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export function useDeposit() {
  const { address, ready } = useWallet();
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const [isDepositing, setIsDepositing] = useState(false);

  const deposit = async (amount: number) => {
    if (!address) {
      dispatch(
        pushToast({ message: "지갑을 연결한 뒤 시도하세요.", type: "error" })
      );
      return;
    }
    if (!ready) {
      dispatch(
        pushToast({
          message: "Monad 네트워크로 전환 후 진행하세요.",
          type: "error",
        })
      );
      return;
    }
    if (amount <= 0) {
      dispatch(
        pushToast({ message: "0보다 큰 금액을 입력하세요.", type: "error" })
      );
      return;
    }

    setIsDepositing(true);
    dispatch(setLoading("Deposit 트랜잭션 실행 중..."));
    try {
      const result = await depositCredits({ walletId: address, amount });
      dispatch(
        pushToast({
          message: result.message || "Deposit 완료",
          type: "success",
        })
      );
      queryClient.invalidateQueries({ queryKey: ["balance", address] });
      return result;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Deposit 중 오류가 발생했습니다.";
      dispatch(pushToast({ message: msg, type: "error" }));
      throw err;
    } finally {
      setIsDepositing(false);
      dispatch(setLoading(undefined));
    }
  };

  return { deposit, isDepositing };
}
