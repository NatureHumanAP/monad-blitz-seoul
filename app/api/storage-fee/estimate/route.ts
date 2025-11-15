import { calculateDailyStorageFee, calculateDaysCovered, calculateMonthlyStorageFee } from '@/lib/pricing';
import { FileListItem } from '@/lib/types/api';
import { getCreditBalance } from '@/services/credit';
import { fileMetadata } from '@/services/metadata';
import { NextRequest, NextResponse } from 'next/server';

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

            return result;
        });

        // Calculate totals
        const totalDailyFee = fileList.reduce((sum, file) => sum + file.dailyStorageFee, 0);
        const totalMonthlyFee = fileList.reduce((sum, file) => sum + file.monthlyStorageFee, 0);
        const daysCovered = calculateDaysCovered(creditBalance, totalDailyFee);

        return NextResponse.json({
            walletAddress,
            creditBalance,
            files: fileList,
            summary: {
                totalDailyFee,
                totalMonthlyFee,
                daysCovered,
                needsDeposit: creditBalance === 0 || daysCovered < 3,
                message: '보관료는 일정 금액을 충전해두면 자동으로 차감됩니다.',
            },
        });
    } catch (error: any) {
        console.error('Storage fee estimate error:', error);
        return NextResponse.json(
            { error: 'Failed to estimate storage fee', details: error.message },
            { status: 500 }
        );
    }
}

