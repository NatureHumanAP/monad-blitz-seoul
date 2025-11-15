import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain, http } from "viem";

// Custom Monad testnet chain (id 41500). RPC URL can be overridden via env.
const monadTestnetRpc =
    process.env.NEXT_PUBLIC_MONAD_RPC ??
    "https://rpc-testnet.monadinfra.com"; // fallback placeholder

export const monadTestnet = defineChain({
    id: 10143,
    name: "Monad Testnet (10143)",
    nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
    rpcUrls: {
        default: { http: [monadTestnetRpc] },
        public: { http: [monadTestnetRpc] },
    },
    blockExplorers: {
        default: {
            name: "Monad Explorer",
            url: "https://testnet.monadexplorer.com",
        },
    },
});

const walletConnectProjectId =
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ??
    process.env.WALLETCONNECT_PROJECT_ID ??
    "";

export const wagmiConfig = getDefaultConfig({
    appName: "Nano Storage",
    projectId: walletConnectProjectId || "WALLETCONNECT_PROJECT_ID_MISSING",
    chains: [monadTestnet],
    transports: {
        [monadTestnet.id]: http(monadTestnetRpc),
    },
    ssr: true,
});
