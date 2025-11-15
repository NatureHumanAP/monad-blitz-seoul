import { NextRequest, NextResponse } from 'next/server';
import { fileMetadata } from '@/services/metadata';
import { getCreditBalance } from '@/services/credit';
import { calculateDailyStorageFee, calculateMonthlyStorageFee, calculateDaysCovered } from '@/lib/pricing';
import { FileListItem } from '@/lib/types/api';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const walletAddress = searchParams.get('walletAddress');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'walletAddress query parameter is required' },
        { status: 400 }
      );
    }

    // Get all files for this wallet
    const files = await fileMetadata.getByWalletId(walletAddress);
    const creditBalance = await getCreditBalance(walletAddress);

    const now = new Date();
    const fileList: FileListItem[] = files.map((file) => {
      const dailyFee = calculateDailyStorageFee(file.fileSize);
      const monthlyFee = calculateMonthlyStorageFee(file.fileSize);
      const expirationDate = new Date(file.expirationDate);
      const daysUntilDeletion = Math.max(0, Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      // Determine storage status
      let storageStatus: 'free_storage' | 'prepaid_storage' | 'locked' | 'expired';
      if (file.downloadLocked) {
        storageStatus = 'locked';
      } else if (file.isPrepaidLinked && creditBalance > 0) {
        storageStatus = 'prepaid_storage';
      } else if (expirationDate < now) {
        storageStatus = 'expired';
      } else {
        storageStatus = 'free_storage';
      }

      const result: FileListItem = {
        fileId: file.fileId,
        fileName: file.fileName,
        fileSize: file.fileSize,
        uploadDate: file.uploadDate,
        expirationDate: file.expirationDate,
        isPrepaidLinked: file.isPrepaidLinked,
        storageStatus,
        dailyStorageFee: dailyFee,
        monthlyStorageFee: monthlyFee,
      };

      if (storageStatus === 'free_storage') {
        result.estimatedDeletionDate = expirationDate.toISOString().split('T')[0];
        result.daysUntilDeletion = daysUntilDeletion;
      }

      if (storageStatus === 'prepaid_storage') {
        result.creditBalance = creditBalance;
        // Calculate total daily fee for all files
        const totalDailyFee = files
          .filter(f => f.isPrepaidLinked)
          .reduce((sum, f) => sum + calculateDailyStorageFee(f.fileSize), 0);
        result.daysCovered = calculateDaysCovered(creditBalance, totalDailyFee);
      }

      return result;
    });

    return NextResponse.json({
      files: fileList,
    });
  } catch (error: any) {
    console.error('Files query error:', error);
    return NextResponse.json(
      { error: 'Failed to get files', details: error.message },
      { status: 500 }
    );
  }
}

