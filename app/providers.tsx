"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Provider } from "react-redux";
import { WagmiProvider } from "wagmi";
import { store } from "@/lib/store";
import { wagmiConfig } from "@/lib/wallet";

export function Providers({ children }: { children: React.ReactNode }) {
  // Create react-query client once per session
  const [queryClient] = useState(() => new QueryClient());

  return (
    <Provider store={store}>
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider modalSize="compact">
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </Provider>
  );
}
