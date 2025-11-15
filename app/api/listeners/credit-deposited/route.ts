import { NextRequest, NextResponse } from 'next/server';
import { updateCreditBalance } from '@/services/credit';
import { ethers } from 'ethers';

/**
 * Webhook endpoint for processing credit deposit events
 * Can be called by an external service that monitors blockchain events
 * or used as a fallback if direct event listening is not available
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { walletId, amount, signature } = body;

    if (!walletId || !amount) {
      return NextResponse.json(
        { error: 'walletId and amount are required' },
        { status: 400 }
      );
    }

    // Optional: Verify signature if provided
    // This would verify that the request is from a trusted source
    if (signature) {
      // TODO: Implement signature verification
    }

    // Convert amount to bigint if it's a string
    const amountBigInt = typeof amount === 'string' ? BigInt(amount) : BigInt(amount);

    // Update credit balance
    await updateCreditBalance(walletId, amountBigInt);

    return NextResponse.json({
      success: true,
      message: 'Credit deposit processed',
      walletId,
      amount: amountBigInt.toString(),
    });
  } catch (error: any) {
    console.error('Credit deposit webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process credit deposit',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

