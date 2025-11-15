import { processStorageFees } from '@/scheduler/storage-fee';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Cron job endpoint for processing storage fees
 * Should be called daily at midnight
 * Configure in vercel.json:
 * {
 *   "crons": [{
 *     "path": "/api/cron/storage-fee",
 *     "schedule": "0 0 * * *"
 *   }]
 * }
 */
export async function GET(request: NextRequest) {
    try {
        // Verify cron secret (optional, for security)
        const authHeader = request.headers.get('authorization');
        const cronSecret = process.env.CRON_SECRET;

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        await processStorageFees();

        return NextResponse.json({
            success: true,
            message: 'Storage fees processed successfully',
            timestamp: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error('Storage fee cron error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to process storage fees',
                details: error.message,
            },
            { status: 500 }
        );
    }
}

