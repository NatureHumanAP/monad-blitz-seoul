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

export async function uploadFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });
  return handleJson<UploadResponse>(res);
}

export async function downloadFile(fileId: string): Promise<Blob> {
  const res = await fetch(`/api/download/${encodeURIComponent(fileId)}`, {
    method: "GET",
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
  return res.blob();
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
  amount: number;
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
