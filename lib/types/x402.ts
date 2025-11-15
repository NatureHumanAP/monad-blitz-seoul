export interface X402PaymentHeaders {
    "X-Payment-Required-Amount": string;
    "X-Payment-Address": string;
    "X-Payment-Token": string;
    "X-Payment-Nonce": string;
    "X-Payment-Chain-Id": string;
}

export interface X402PaymentRequest {
    "X-Payment-Signature"?: string;
    "X-Payment-Wallet-Id"?: string;
    "X-Payment-Tx-Hash"?: string;
    "X-Wallet-Id"?: string;
    "X-Wallet-Signature"?: string;
}

export interface PaymentMessage {
    fileId: string;
    amount: number;
    nonce: string;
    timestamp: number;
}

