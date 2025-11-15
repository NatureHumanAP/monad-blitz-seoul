import { NextRequest, NextResponse } from 'next/server';
import { generateFileId, isValidFileType, isValidFileSize } from '@/lib/file-utils';
import { saveFile } from '@/services/storage';
import { fileMetadata } from '@/services/metadata';
import { calculateDailyStorageFee, calculateMonthlyStorageFee } from '@/lib/pricing';
import { STORAGE_CONFIG } from '@/config/storage';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const walletId = formData.get('walletId') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    if (!walletId) {
      return NextResponse.json(
        { error: 'Wallet ID is required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!isValidFileType(file.type)) {
      return NextResponse.json(
        { error: 'File type not allowed. Only images and documents are supported.' },
        { status: 400 }
      );
    }

    // Validate file size
    if (!isValidFileSize(file.size)) {
      return NextResponse.json(
        { error: `File size exceeds limit of ${STORAGE_CONFIG.maxFileSize / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Generate file ID
    const fileId = generateFileId(fileBuffer);

    // Check if file already exists
    const existingFile = await fileMetadata.getById(fileId);
    if (existingFile) {
      // File already exists, return existing metadata
      const dailyFee = calculateDailyStorageFee(file.size);
      const monthlyFee = calculateMonthlyStorageFee(file.size);
      const expirationDate = new Date(existingFile.expirationDate);
      const now = new Date();
      const daysUntilDeletion = Math.max(0, Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      return NextResponse.json({
        fileId: existingFile.fileId,
        downloadUrl: `/api/download/${fileId}`,
        storageInfo: {
          hasPrepaidStorage: existingFile.isPrepaidLinked,
          estimatedDeletionDate: expirationDate.toISOString().split('T')[0],
          daysUntilDeletion,
          message: existingFile.isPrepaidLinked
            ? '보관료가 활성화되어 크레딧으로 자동 차감됩니다.'
            : '30일 무료 보관 제공. 장기 보관을 원하시면 크레딧을 충전하여 보관료를 활성화해주세요.',
          dailyStorageFee: dailyFee,
          monthlyStorageFee: monthlyFee,
        },
      });
    }

    // Save file to storage
    await saveFile(fileId, fileBuffer);

    // Calculate expiration date (30 days from now)
    const uploadDate = new Date();
    const expirationDate = new Date(uploadDate);
    expirationDate.setDate(expirationDate.getDate() + STORAGE_CONFIG.freeStorageDays);

    // Calculate fees
    const dailyFee = calculateDailyStorageFee(file.size);
    const monthlyFee = calculateMonthlyStorageFee(file.size);

    // Save metadata
    await fileMetadata.save({
      fileId,
      fileName: file.name,
      fileSize: file.size,
      filePath: '', // Will be generated on read
      uploaderWalletId: walletId.toLowerCase(),
      uploadDate: uploadDate.toISOString(),
      expirationDate: expirationDate.toISOString(),
      isPrepaidLinked: false,
      downloadLocked: false,
    });

    return NextResponse.json({
      fileId,
      downloadUrl: `/api/download/${fileId}`,
      storageInfo: {
        hasPrepaidStorage: false,
        estimatedDeletionDate: expirationDate.toISOString().split('T')[0],
        daysUntilDeletion: STORAGE_CONFIG.freeStorageDays,
        message: '30일 무료 보관 제공. 장기 보관을 원하시면 크레딧을 충전하여 보관료를 활성화해주세요.',
        dailyStorageFee: dailyFee,
        monthlyStorageFee: monthlyFee,
      },
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error.message },
      { status: 500 }
    );
  }
}

