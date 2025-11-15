import { getMimeTypeFromFileName } from '@/lib/file-utils';
import { fileMetadata } from '@/services/metadata';
import { createX402Headers, processDownloadPayment } from '@/services/payment';
import { fileExists, getFileStream } from '@/services/storage';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fileId: string }> }
) {
    try {
        const { fileId } = await params;
        const headers = Object.fromEntries(
            request.headers.entries()
        );

        // Get file metadata
        const metadata = await fileMetadata.getById(fileId);
        if (!metadata) {
            return NextResponse.json(
                { error: 'File not found' },
                { status: 404 }
            );
        }

        // Check if file exists in storage
        if (!(await fileExists(fileId))) {
            return NextResponse.json(
                { error: 'File not found in storage' },
                { status: 404 }
            );
        }

        // Check if download is locked
        if (metadata.downloadLocked) {
            return NextResponse.json(
                { error: 'File download is locked. Please recharge your credits.' },
                { status: 403 }
            );
        }

        // Get wallet ID from headers
        const walletId = headers['x-wallet-id'] || headers['x-payment-wallet-id'];
        if (!walletId) {
            return NextResponse.json(
                { error: 'Wallet ID is required' },
                { status: 400 }
            );
        }

        // Process payment
        const paymentResult = await processDownloadPayment(
            walletId,
            fileId,
            metadata.fileSize,
            headers
        );

        if (!paymentResult.success) {
            // Payment required - return 402 with x402 headers
            if (paymentResult.nonce && paymentResult.amount) {
                const x402Headers = createX402Headers(paymentResult.amount, paymentResult.nonce);
                return new NextResponse(null, {
                    status: 402,
                    headers: x402Headers,
                });
            }
            return NextResponse.json(
                { error: 'Payment required' },
                { status: 402 }
            );
        }

        // Payment successful - stream file
        const fileStream = await getFileStream(fileId);

        // Get MIME type from file extension
        const contentType = getMimeTypeFromFileName(metadata.fileName);

        // Encode filename for Content-Disposition header (RFC 5987)
        // Extract file extension to preserve it
        const fileExt = metadata.fileName.includes('.')
            ? metadata.fileName.substring(metadata.fileName.lastIndexOf('.'))
            : '';

        // Create ASCII-safe fallback filename (preserve extension)
        // Replace non-ASCII characters with underscore, but keep extension
        const baseName = fileExt
            ? metadata.fileName.substring(0, metadata.fileName.lastIndexOf('.'))
            : metadata.fileName;
        const asciiBaseName = baseName.replace(/[^\x20-\x7E]/g, '_') || 'download';
        const asciiSafeFileName = asciiBaseName + fileExt;

        // Encode filename for filename* parameter (already ASCII-safe after encoding)
        const encodedFileName = encodeURIComponent(metadata.fileName);

        // Build Content-Disposition header
        // Use both filename (ASCII-safe) and filename* (UTF-8 encoded) for maximum compatibility
        // The filename* value is already ASCII-safe after encodeURIComponent
        const contentDisposition = `attachment; filename="${asciiSafeFileName}"; filename*=UTF-8''${encodedFileName}`;

        // Use Response constructor to avoid NextResponse header encoding issues
        return new Response(fileStream as any, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': contentDisposition,
                'Content-Length': metadata.fileSize.toString(),
            },
        });
    } catch (error: any) {
        console.error('Download error:', error);
        return NextResponse.json(
            { error: 'Failed to download file', details: error.message },
            { status: 500 }
        );
    }
}

