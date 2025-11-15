import "@nomicfoundation/hardhat-toolbox";
import * as dotenv from "dotenv";
dotenv.config();

const config = {
    solidity: {
        version: "0.8.20",
        settings: {
            optimizer: {
                enabled: true,
                runs: 200,
            },
        },
    },
    networks: {
        hardhat: {
            chainId: 1337,
        },
        monadTestnet: {
            url: process.env.MONAD_TESTNET_RPC_URL || "https://testnet-rpc.monad.xyz",
            chainId: 41500,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
        monadMainnet: {
            url: process.env.MONAD_MAINNET_RPC_URL || "https://rpc.monad.xyz",
            chainId: 41501,
            accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
        },
    },
    paths: {
        sources: "./contracts",
        tests: "./test",
        cache: "./cache",
        artifacts: "./artifacts",
    },
    etherscan: {
        apiKey: {
            monadTestnet: process.env.MONAD_EXPLORER_API_KEY || "",
            monadMainnet: process.env.MONAD_EXPLORER_API_KEY || "",
        },
        customChains: [
            {
                network: "monadTestnet",
                chainId: 41500,
                urls: {
                    apiURL: "https://testnet-explorer.monad.xyz/api",
                    browserURL: "https://testnet-explorer.monad.xyz",
                },
            },
            {
                network: "monadMainnet",
                chainId: 41501,
                urls: {
                    apiURL: "https://explorer.monad.xyz/api",
                    browserURL: "https://explorer.monad.xyz",
                },
            },
        ],
    },
} as any;

export default config;
