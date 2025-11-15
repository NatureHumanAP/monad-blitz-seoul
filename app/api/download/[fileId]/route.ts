import { fileMetadata } from "@/services/metadata";
import { createX402Headers, processDownloadPayment } from "@/services/payment";
import { fileExists, getFileStream } from "@/services/storage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ fileId: string }> },
) {
    try {
        const { fileId } = await params;
        const headers = Object.fromEntries(
            request.headers.entries(),
        );

        // Get file metadata
        const metadata = await fileMetadata.getById(fileId);
        if (!metadata) {
            return NextResponse.json(
                { error: "File not found" },
                { status: 404 },
            );
        }

        // Check if file exists in storage
        if (!(await fileExists(fileId))) {
            return NextResponse.json(
                { error: "File not found in storage" },
                { status: 404 },
            );
        }

        // Check if download is locked
        if (metadata.downloadLocked) {
            return NextResponse.json(
                { error: "File download is locked. Please recharge your credits." },
                { status: 403 },
            );
        }

        // Get wallet ID from headers
        const walletId = headers["x-wallet-id"] || headers["x-payment-wallet-id"];
        if (!walletId) {
            return NextResponse.json(
                { error: "Wallet ID is required" },
                { status: 400 },
            );
        }

        // Process payment
        const paymentResult = await processDownloadPayment(
            walletId,
            fileId,
            metadata.fileSize,
            headers,
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
                { error: "Payment required" },
                { status: 402 },
            );
        }

        // Payment successful - stream file
        const fileStream = await getFileStream(fileId);

        return new NextResponse(fileStream as any, {
            headers: {
                "Content-Type": "application/octet-stream",
                "Content-Disposition": `attachment; filename="${metadata.fileName}"`,
                "Content-Length": metadata.fileSize.toString(),
            },
        });
    } catch (error: any) {
        console.error("Download error:", error);
        return NextResponse.json(
            { error: "Failed to download file", details: error.message },
            { status: 500 },
        );
    }
}

