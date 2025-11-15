import { promises as fs } from "fs";
import path from "path";
import { STORAGE_CONFIG } from "@/config/storage";
import { FileMetadata, WalletData, PaymentRecord } from "@/lib/types/metadata";

// Simple file locking mechanism using a Map
const fileLocks = new Map<string, Promise<void>>();

/**
 * Acquire a lock for a file
 */
async function acquireLock(filePath: string): Promise<() => void> {
    let release: () => void;
    const lockPromise = new Promise<void>((resolve) => {
        release = resolve;
    });

    const existingLock = fileLocks.get(filePath);
    if (existingLock) {
        await existingLock;
    }

    fileLocks.set(filePath, lockPromise);
    return () => {
        fileLocks.delete(filePath);
        release!();
    };
}

/**
 * Read JSON file with locking
 */
async function readJsonFile<T>(filePath: string): Promise<T> {
    const release = await acquireLock(filePath);
    try {
        const data = await fs.readFile(filePath, "utf-8");
        return JSON.parse(data) as T;
    } catch (error: any) {
        if (error.code === "ENOENT") {
            // File doesn't exist, return empty object
            return {} as T;
        }
        throw error;
    } finally {
        release();
    }
}

/**
 * Write JSON file with locking
 */
async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    const release = await acquireLock(filePath);
    try {
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
    } finally {
        release();
    }
}

// File paths
const FILES_METADATA_PATH = path.join(STORAGE_CONFIG.metadataDir, "files.json");
const WALLETS_METADATA_PATH = path.join(STORAGE_CONFIG.metadataDir, "wallets.json");
const PAYMENTS_METADATA_PATH = path.join(STORAGE_CONFIG.metadataDir, "payments.json");

/**
 * File Metadata Operations
 */
export const fileMetadata = {
    /**
   * Get all files metadata
   */
    async getAll(): Promise<Record<string, FileMetadata>> {
        return readJsonFile<Record<string, FileMetadata>>(FILES_METADATA_PATH);
    },

    /**
   * Get file metadata by ID
   */
    async getById(fileId: string): Promise<FileMetadata | null> {
        const files = await this.getAll();
        return files[fileId] || null;
    },

    /**
   * Save file metadata
   */
    async save(metadata: FileMetadata): Promise<void> {
        const files = await this.getAll();
        files[metadata.fileId] = metadata;
        await writeJsonFile(FILES_METADATA_PATH, files);
    },

    /**
   * Update file metadata
   */
    async update(fileId: string, updates: Partial<FileMetadata>): Promise<void> {
        const files = await this.getAll();
        if (files[fileId]) {
            files[fileId] = { ...files[fileId], ...updates };
            await writeJsonFile(FILES_METADATA_PATH, files);
        }
    },

    /**
   * Delete file metadata
   */
    async delete(fileId: string): Promise<void> {
        const files = await this.getAll();
        delete files[fileId];
        await writeJsonFile(FILES_METADATA_PATH, files);
    },

    /**
   * Get files by wallet ID
   */
    async getByWalletId(walletId: string): Promise<FileMetadata[]> {
        const files = await this.getAll();
        return Object.values(files).filter(
            (file) => file.uploaderWalletId.toLowerCase() === walletId.toLowerCase(),
        );
    },

    /**
   * Update isPrepaidLinked for all files of a wallet
   */
    async updatePrepaidLinkedByWallet(walletId: string, isPrepaidLinked: boolean): Promise<void> {
        const files = await this.getAll();
        let updated = false;
        for (const fileId in files) {
            if (files[fileId].uploaderWalletId.toLowerCase() === walletId.toLowerCase()) {
                files[fileId].isPrepaidLinked = isPrepaidLinked;
                updated = true;
            }
        }
        if (updated) {
            await writeJsonFile(FILES_METADATA_PATH, files);
        }
    },
};

/**
 * Wallet Data Operations
 */
export const walletData = {
    /**
   * Get all wallets data
   */
    async getAll(): Promise<Record<string, WalletData>> {
        return readJsonFile<Record<string, WalletData>>(WALLETS_METADATA_PATH);
    },

    /**
   * Get wallet data by ID
   */
    async getById(walletId: string): Promise<WalletData | null> {
        const wallets = await this.getAll();
        const normalizedId = walletId.toLowerCase();
        return wallets[normalizedId] || null;
    },

    /**
   * Save or update wallet data
   */
    async save(data: WalletData): Promise<void> {
        const wallets = await this.getAll();
        const normalizedId = data.walletId.toLowerCase();
        wallets[normalizedId] = {
            ...data,
            walletId: normalizedId,
            lastUpdated: new Date().toISOString(),
        };
        await writeJsonFile(WALLETS_METADATA_PATH, wallets);
    },

    /**
   * Update wallet credit balance
   */
    async updateBalance(walletId: string, creditBalance: number): Promise<void> {
        const wallets = await this.getAll();
        const normalizedId = walletId.toLowerCase();
        wallets[normalizedId] = {
            walletId: normalizedId,
            creditBalance,
            lastUpdated: new Date().toISOString(),
        };
        await writeJsonFile(WALLETS_METADATA_PATH, wallets);
    },

    /**
   * Add credit to wallet
   */
    async addCredit(walletId: string, amount: number): Promise<number> {
        const existing = await this.getById(walletId);
        const newBalance = (existing?.creditBalance || 0) + amount;
        await this.updateBalance(walletId, newBalance);
        return newBalance;
    },

    /**
   * Deduct credit from wallet
   */
    async deductCredit(walletId: string, amount: number): Promise<number> {
        const existing = await this.getById(walletId);
        const currentBalance = existing?.creditBalance || 0;
        const newBalance = Math.max(0, currentBalance - amount);
        await this.updateBalance(walletId, newBalance);
        return newBalance;
    },
};

/**
 * Payment Record Operations (for nonce management)
 */
export const paymentRecords = {
    /**
   * Get all payment records
   */
    async getAll(): Promise<Record<string, PaymentRecord>> {
        return readJsonFile<Record<string, PaymentRecord>>(PAYMENTS_METADATA_PATH);
    },

    /**
   * Get payment record by nonce
   */
    async getByNonce(nonce: string): Promise<PaymentRecord | null> {
        const payments = await this.getAll();
        return payments[nonce] || null;
    },

    /**
   * Save payment record
   */
    async save(record: PaymentRecord): Promise<void> {
        const payments = await this.getAll();
        payments[record.nonce] = record;
        await writeJsonFile(PAYMENTS_METADATA_PATH, payments);
    },

    /**
   * Check if nonce has been used
   */
    async isNonceUsed(nonce: string): Promise<boolean> {
        const record = await this.getByNonce(nonce);
        return record !== null;
    },

    /**
   * Clean up old payment records (older than 24 hours)
   */
    async cleanupOldRecords(): Promise<void> {
        const payments = await this.getAll();
        const now = Date.now();
        const oneDayAgo = now - 24 * 60 * 60 * 1000;

        let updated = false;
        for (const nonce in payments) {
            const usedAt = new Date(payments[nonce].usedAt).getTime();
            if (usedAt < oneDayAgo) {
                delete payments[nonce];
                updated = true;
            }
        }

        if (updated) {
            await writeJsonFile(PAYMENTS_METADATA_PATH, payments);
        }
    },
};

