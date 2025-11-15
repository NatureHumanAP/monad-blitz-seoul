import { FileMetadata } from './metadata';

export interface UploadResponse {
  fileId: string;
  downloadUrl: string;
  storageInfo: {
    hasPrepaidStorage: boolean;
    estimatedDeletionDate: string;
    daysUntilDeletion: number;
    message: string;
    dailyStorageFee: number;
    monthlyStorageFee: number;
  };
}

export interface FileListResponse {
  files: FileListItem[];
}

export interface FileListItem {
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
}

export interface BalanceResponse {
  walletId: string;
  creditBalance: number;
}

export interface StorageFeeEstimateResponse {
  walletAddress: string;
  creditBalance: number;
  files: FileListItem[];
  summary: {
    totalDailyFee: number;
    totalMonthlyFee: number;
    daysCovered: number;
    needsDeposit: boolean;
    message: string;
  };
}

