import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  // TODO: Implement repository issues estimation logic
  // Get request and parse github project link example: https://github.com/remix-project-org/remix-project
  return NextResponse.json({
    error: 'Not implemented'
  }, { status: 501 });
}
