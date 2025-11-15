"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchBalance } from "@/lib/api";
import { useWallet } from "./useWallet";

export function useBalance() {
  const { address, ready } = useWallet();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["balance", address],
    queryFn: () => fetchBalance(address || ""),
    enabled: ready && !!address,
    staleTime: 30_000,
  });

  const refresh = () => {
    if (!address) return;
    queryClient.invalidateQueries({ queryKey: ["balance", address] });
  };

  return {
    balance: query.data?.balance,
    isLoading: query.isLoading,
    error: query.error as Error | null,
    refresh,
  };
}
