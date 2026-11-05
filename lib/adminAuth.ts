import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the `x-admin-key` request header against `process.env.ADMIN_KEY`.
 * Uses timing-safe string comparison to prevent timing attacks.
 *
 * - Returns 500 if ADMIN_KEY is not configured on the server.
 * - Returns 401 if header is missing or incorrect.
 * - Returns empty object {} if authorized.
 */
export function requireAdmin(req: NextRequest): { errorResponse?: NextResponse } {
  const expectedKey = process.env.ADMIN_KEY;
  if (!expectedKey) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Server misconfigured: ADMIN_KEY is not set' },
        { status: 500 }
      ),
    };
  }

  const providedKey = req.headers.get('x-admin-key');
  if (!providedKey) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Missing x-admin-key header' },
        { status: 401 }
      ),
    };
  }

  const providedBuf = Buffer.from(providedKey);
  const expectedBuf = Buffer.from(expectedKey);

  if (
    providedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Invalid admin key' },
        { status: 401 }
      ),
    };
  }

  return {};
}

