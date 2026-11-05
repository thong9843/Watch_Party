import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// In-memory IP rate limiter: max 5 reports / 60 seconds / IP
const reportRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkReportRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = reportRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    reportRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
    return true;
  }
  if (record.count >= 5) {
    return false;
  }
  record.count++;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    if (!checkReportRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Bạn gửi báo cáo quá nhanh. Vui lòng đợi 1 phút!' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { reporterId, reportedId, reason, roomId = 'room-cktg-1' } = body;

    if (!reportedId || !reason) {
      return NextResponse.json({ error: 'Thiếu thông tin báo cáo bắt buộc' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
      await supabaseServer.from('reports').insert({
        reporter_id: reporterId || 'anonymous',
        reported_id: reportedId,
        reason: String(reason).slice(0, 200),
        room_id: roomId,
        status: 'pending',
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Cảm ơn bạn đã gửi báo cáo. Ban quản trị sẽ xem xét sớm nhất!',
    });
  } catch (err: any) {
    console.error('Server Report Error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý báo cáo' }, { status: 500 });
  }
}

