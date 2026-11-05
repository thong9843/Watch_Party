import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import { checkDbRateLimit } from '@/lib/dbRateLimit';

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Admin Key
    const auth = requireAdmin(req);
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    // 2. Database Rate Limit: 10 requests / 60 seconds / IP
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const allowed = await checkDbRateLimit(`admin_config:${ip}`, 10, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Vượt quá giới hạn (tối đa 10 lần đổi / phút). Vui lòng đợi!' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      roomId = 'room-cktg-1',
      videoUrl,
      topBanner,
      bottomBanner,
      cinemaLights,
      senderName = 'Admin',
    } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabaseServer = createClient(supabaseUrl, serviceRoleKey);

      // Update room_config table (Client receives update via postgres_changes)
      const updatePayload: Record<string, any> = {
        room_id: roomId,
        updated_at: new Date().toISOString(),
        updated_by: senderName,
      };
      if (videoUrl !== undefined) updatePayload.video_url = videoUrl;
      if (topBanner !== undefined) updatePayload.top_banner = topBanner;
      if (bottomBanner !== undefined) updatePayload.bottom_banner = bottomBanner;
      if (cinemaLights !== undefined) updatePayload.cinema_lights = cinemaLights;

      const { error } = await supabaseServer.from('room_config').upsert(updatePayload);
      if (error) {
        console.error('Supabase room_config upsert error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật cấu hình phòng thành công!',
      data: { roomId, videoUrl, topBanner, bottomBanner, cinemaLights },
    });
  } catch (err: any) {
    console.error('Server Admin Config Error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý yêu cầu' }, { status: 500 });
  }
}
