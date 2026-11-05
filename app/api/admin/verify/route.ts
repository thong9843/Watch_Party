import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { checkDbRateLimit } from '@/lib/dbRateLimit';

export async function POST(req: NextRequest) {
  // 1. Authenticate Admin Key
  const auth = requireAdmin(req);
  if (auth.errorResponse) {
    return auth.errorResponse;
  }

  // 2. Rate limit: 10 requests / 60 seconds / IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
  const allowed = await checkDbRateLimit(`admin_verify:${ip}`, 10, 60);
  if (!allowed) {
    return NextResponse.json(
      { error: 'Vượt quá giới hạn xác thực (tối đa 10 lần/phút)' },
      { status: 429 }
    );
  }

  return NextResponse.json({
    success: true,
    message: 'Admin key hợp lệ',
  });
}

