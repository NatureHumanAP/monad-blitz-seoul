"use client";

import { fetchBalance } from "@/lib/api";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useWallet } from "./useWallet";

export function useBalance() {
    const { address, ready } = useWallet();

    const query = useQuery({
        queryKey: ["balance", address],
        queryFn: () => fetchBalance(address || ""),
        enabled: ready && !!address,
        gcTime: 1000 * 60 * 5, // 5 minutes
    });

    return useMemo(
        () => ({
            balance: query.data?.balance,
            isLoading: query.isLoading,
            error: query.error as Error | null,
        }),
        [query.data?.balance, query.isLoading, query.error]
    );
}
