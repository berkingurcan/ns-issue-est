import { NextResponse } from 'next/server';

interface RateLimitStore {
  [ip: string]: {
    daily: { count: number; resetTime: number };
    shortTerm: { count: number; resetTime: number };
  };
}

const store: RateLimitStore = {};

// Clean up old entries every hour
setInterval(() => {
  const now = Date.now();
  Object.keys(store).forEach((ip) => {
    if (
      store[ip].daily.resetTime < now &&
      store[ip].shortTerm.resetTime < now
    ) {
      delete store[ip];
    }
  });
}, 60 * 60 * 1000);

function getClientIP(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
  return ip;
}

export async function checkRateLimit(
  request: Request
): Promise<NextResponse | null> {
  const ip = getClientIP(request);
  const now = Date.now();

  if (!store[ip]) {
    store[ip] = {
      daily: {
        count: 0,
        resetTime: now + 24 * 60 * 60 * 1000, // 24 hours
      },
      shortTerm: {
        count: 0,
        resetTime: now + 5 * 60 * 1000, // 5 minutes
      },
    };
  }

  const ipData = store[ip];

  // Reset daily counter if expired
  if (ipData.daily.resetTime < now) {
    ipData.daily = {
      count: 0,
      resetTime: now + 24 * 60 * 60 * 1000,
    };
  }

  // Reset short-term counter if expired
  if (ipData.shortTerm.resetTime < now) {
    ipData.shortTerm = {
      count: 0,
      resetTime: now + 5 * 60 * 1000,
    };
  }

  // Check daily limit (100 requests per day)
  if (ipData.daily.count >= 100) {
    return NextResponse.json(
      {
        error: 'Daily rate limit exceeded. Maximum 100 requests per day.',
        retryAfter: Math.ceil((ipData.daily.resetTime - now) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit-Daily': '100',
          'X-RateLimit-Remaining-Daily': '0',
          'X-RateLimit-Reset-Daily': new Date(
            ipData.daily.resetTime
          ).toISOString(),
          'Retry-After': String(
            Math.ceil((ipData.daily.resetTime - now) / 1000)
          ),
        },
      }
    );
  }

  // Check short-term limit (10 requests per 5 minutes)
  if (ipData.shortTerm.count >= 10) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded. Maximum 10 requests per 5 minutes.',
        retryAfter: Math.ceil((ipData.shortTerm.resetTime - now) / 1000),
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit-Short': '10',
          'X-RateLimit-Remaining-Short': '0',
          'X-RateLimit-Reset-Short': new Date(
            ipData.shortTerm.resetTime
          ).toISOString(),
          'Retry-After': String(
            Math.ceil((ipData.shortTerm.resetTime - now) / 1000)
          ),
        },
      }
    );
  }

  // Increment counters
  ipData.daily.count++;
  ipData.shortTerm.count++;

  return null;
}
