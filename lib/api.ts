export type StorageInfo = {
    hasPrepaidStorage: boolean;
    estimatedDeletionDate: string;
    daysUntilDeletion: number;
    message?: string;
    dailyStorageFee?: number;
    monthlyStorageFee?: number;
};

export type UploadResponse = {
    fileId: string;
    downloadUrl: string;
    message?: string;
    storageInfo?: StorageInfo;
};

export type BalanceResponse = {
    walletId: string;
    balance: number;
    updatedAt?: string;
};

export type DepositResponse = {
    txId?: string;
    balance?: number;
    message?: string;
};

export type FileListItem = {
    fileId: string;
    fileName: string;
    fileSize: number;
    uploadDate: string;
    expirationDate: string;
    isPrepaidLinked: boolean;
    storageStatus: 'free_storage' | 'prepaid_storage' | 'locked' | 'expired';
    estimatedDeletionDate?: string;
    daysUntilDeletion?: number;
    dailyStorageFee: number;
    monthlyStorageFee: number;
    creditBalance?: number;
    daysCovered?: number;
};

export type FileListResponse = {
    files: FileListItem[];
};

export class PaymentRequiredError extends Error {
    amount?: string;
    address?: string;
    token?: string;
    nonce?: string;
    chainId?: string;

    constructor(init: {
        amount?: string;
        address?: string;
        token?: string;
        nonce?: string;
        chainId?: string;
    }) {
        super("Payment required");
        this.amount = init.amount;
        this.address = init.address;
        this.token = init.token;
        this.nonce = init.nonce;
        this.chainId = init.chainId;
    }
}

async function handleJson<T>(res: Response): Promise<T> {
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Request failed (${res.status})`);
    }
    return res.json() as Promise<T>;
}

export async function uploadFile(file: File, walletId: string): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("walletId", walletId);
    const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
    });
    return handleJson<UploadResponse>(res);
}

export async function downloadFile(
    fileId: string,
    walletId: string,
    paymentSignature?: string,
    paymentNonce?: string,
    paymentTimestamp?: number
): Promise<{ blob: Blob; filename?: string }> {
    const headers: Record<string, string> = {
        "X-Wallet-Id": walletId,
    };

    if (paymentSignature && paymentNonce) {
        headers["X-Payment-Signature"] = paymentSignature;
        headers["X-Payment-Nonce"] = paymentNonce;
        headers["X-Payment-Wallet-Id"] = walletId;
        if (paymentTimestamp) {
            headers["X-Payment-Timestamp"] = paymentTimestamp.toString();
        }
    }

    const res = await fetch(`/api/download/${encodeURIComponent(fileId)}`, {
        method: "GET",
        headers,
    });
    if (res.status === 402) {
        throw new PaymentRequiredError({
            amount: res.headers.get("X-Payment-Required-Amount") || undefined,
            address: res.headers.get("X-Payment-Address") || undefined,
            token: res.headers.get("X-Payment-Token") || undefined,
            nonce: res.headers.get("X-Payment-Nonce") || undefined,
            chainId: res.headers.get("X-Payment-Chain-Id") || undefined,
        });
    }
    if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Download failed (${res.status})`);
    }

    // Extract filename from Content-Disposition header
    const contentDisposition = res.headers.get("Content-Disposition");
    let filename: string | undefined;
    if (contentDisposition) {
        // Try to extract from filename*=UTF-8''... first
        const utf8Match = contentDisposition.match(/filename\*=UTF-8''(.+?)(?:;|$)/);
        if (utf8Match) {
            filename = decodeURIComponent(utf8Match[1]);
        } else {
            // Fallback to filename="..."
            const quotedMatch = contentDisposition.match(/filename="(.+?)"/);
            if (quotedMatch) {
                filename = quotedMatch[1];
            }
        }
    }

    return {
        blob: await res.blob(),
        filename,
    };
}

export async function fetchBalance(
    walletId: string
): Promise<BalanceResponse> {
    const res = await fetch(
        `/api/balance/${encodeURIComponent(walletId)}`,
        { method: "GET" }
    );
    return handleJson<BalanceResponse>(res);
}

export async function depositCredits(params: {
    walletId: string;
    txHash: string;
    amount?: number;
}): Promise<DepositResponse> {
    const res = await fetch("/api/deposit", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
    });
    return handleJson<DepositResponse>(res);
}

export async function fetchFileList(walletAddress: string): Promise<FileListResponse> {
    const res = await fetch(
        `/api/files?walletAddress=${encodeURIComponent(walletAddress)}`,
        { method: "GET" }
    );
    return handleJson<FileListResponse>(res);
}
