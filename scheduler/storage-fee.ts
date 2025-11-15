import { fileMetadata, walletData } from '@/services/metadata';
import { deleteFile } from '@/services/storage';
import { calculateDailyStorageFee } from '@/lib/pricing';
import { deductCredit } from '@/services/credit';

/**
 * Process storage fee deduction for all prepaid files
 */
export async function processStorageFees(): Promise<void> {
  console.log('Starting storage fee processing...');

  const files = await fileMetadata.getAll();
  const wallets = await walletData.getAll();
  const now = new Date();

  // Process prepaid files (isPrepaidLinked = true)
  const prepaidFiles = Object.values(files).filter((file) => file.isPrepaidLinked);
  
  // Group files by wallet ID
  const filesByWallet = new Map<string, typeof prepaidFiles>();
  for (const file of prepaidFiles) {
    const walletId = file.uploaderWalletId.toLowerCase();
    if (!filesByWallet.has(walletId)) {
      filesByWallet.set(walletId, []);
    }
    filesByWallet.get(walletId)!.push(file);
  }

  // Process each wallet's files
  for (const [walletId, walletFiles] of filesByWallet.entries()) {
    const wallet = wallets[walletId.toLowerCase()];
    if (!wallet) {
      continue;
    }

    // Calculate total daily fee for this wallet's files
    const totalDailyFee = walletFiles.reduce(
      (sum, file) => sum + calculateDailyStorageFee(file.fileSize),
      0
    );

    // Deduct storage fee (uses on-chain contract if available)
    const newBalance = await deductCredit(walletId, totalDailyFee);

    // Check if balance is low (less than 3 days)
    const daysCovered = totalDailyFee > 0 ? newBalance / totalDailyFee : Infinity;
    
    if (daysCovered < 3 && daysCovered > 0) {
      console.warn(`Low balance warning for wallet ${walletId}: ${daysCovered.toFixed(2)} days covered`);
      // TODO: Send notification to user
    }

    // If balance is zero, lock all files
    if (newBalance === 0) {
      for (const file of walletFiles) {
        await fileMetadata.update(file.fileId, { downloadLocked: true });
      }
      console.log(`Locked ${walletFiles.length} files for wallet ${walletId} due to zero balance`);
    }
  }

  // Process free storage files (isPrepaidLinked = false)
  // Delete expired files
  const freeFiles = Object.values(files).filter(
    (file) => !file.isPrepaidLinked
  );

  for (const file of freeFiles) {
    const expirationDate = new Date(file.expirationDate);
    
    // Check if file is expired (with 7-day grace period for locked files)
    const gracePeriodEnd = new Date(expirationDate);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 7);
    
    if (file.downloadLocked && now > gracePeriodEnd) {
      // Delete locked file after grace period
      try {
        await deleteFile(file.fileId);
        await fileMetadata.delete(file.fileId);
        console.log(`Deleted expired locked file: ${file.fileId}`);
      } catch (error) {
        console.error(`Error deleting file ${file.fileId}:`, error);
      }
    } else if (!file.downloadLocked && now > expirationDate) {
      // Delete expired free storage file
      try {
        await deleteFile(file.fileId);
        await fileMetadata.delete(file.fileId);
        console.log(`Deleted expired file: ${file.fileId}`);
      } catch (error) {
        console.error(`Error deleting file ${file.fileId}:`, error);
      }
    }
  }

  console.log('Storage fee processing completed');
}

