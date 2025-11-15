import { NextRequest, NextResponse } from "next/server";
import { getCreditBalance } from "@/services/credit";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ walletId: string }> },
) {
    try {
        const { walletId } = await params;
        const balance = await getCreditBalance(walletId);

        return NextResponse.json({
            walletId,
            creditBalance: balance,
        });
    } catch (error: any) {
        console.error("Balance query error:", error);
        return NextResponse.json(
            { error: "Failed to get balance", details: error.message },
            { status: 500 },
        );
    }
}

