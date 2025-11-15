import { getCreditBalance } from '@/services/credit';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ walletId: string }> }
) {
    try {
        const { walletId } = await params;
        // Normalize walletId to lowercase (consistent with storage)
        const normalizedWalletId = walletId.toLowerCase();
        const balance = await getCreditBalance(normalizedWalletId);

        return NextResponse.json({
            walletId,
            balance,
        });
    } catch (error: any) {
        console.error('Balance query error:', error);
        return NextResponse.json(
            { error: 'Failed to get balance', details: error.message },
            { status: 500 }
        );
    }
}

