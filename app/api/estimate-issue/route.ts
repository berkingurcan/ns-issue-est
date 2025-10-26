import { NextResponse } from 'next/server';

export async function POST() {
  // TODO: Implement issue estimation logic
  // Get requested issue link example: https://github.com/remix-project-org/remix-project/issues/6469
  return NextResponse.json(
    {
      error: 'Not implemented',
    },
    { status: 501 }
  );
}
