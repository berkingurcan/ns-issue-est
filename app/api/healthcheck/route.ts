import { NextResponse } from 'next/server';
import { checkRateLimit } from '@/app/_lib/middleware/rateLimit';

export async function GET(request: Request) {
  const rateLimitResponse = await checkRateLimit(request);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}
