export interface FileMetadata {
    fileId: string;
    fileName: string;
    fileSize: number;
    filePath: string;
    uploaderWalletId: string;
    uploadDate: string; // ISO 8601 format
    expirationDate: string; // ISO 8601 format
    isPrepaidLinked: boolean;
    downloadLocked: boolean;
}

export interface WalletData {
    walletId: string;
    creditBalance: number;
    lastUpdated: string; // ISO 8601 format
}

export interface PaymentRecord {
    nonce: string;
    walletId: string;
    fileId: string;
    usedAt: string; // ISO 8601 format
    amount: number;
}

