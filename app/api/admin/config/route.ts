import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// In-memory IP rate limiter: max 5 requests / 60 seconds / IP
const ipRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = ipRateLimitMap.get(ip);
  if (!record || now > record.resetAt) {
    ipRateLimitMap.set(ip, { count: 1, resetAt: now + 60000 });
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
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Vượt quá giới hạn (tối đa 5 lần đổi / phút). Vui lòng đợi!' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { roomId = 'room-cktg-1', videoUrl, topBanner, bottomBanner, cinemaLights, senderName = 'Admin' } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabaseServer = createClient(supabaseUrl, serviceRoleKey);

      // 1. Update database room_config with service role
      const updatePayload: Record<string, any> = {
        room_id: roomId,
        updated_at: new Date().toISOString(),
        updated_by: senderName,
      };
      if (videoUrl !== undefined) updatePayload.video_url = videoUrl;
      if (topBanner !== undefined) updatePayload.top_banner = topBanner;
      if (bottomBanner !== undefined) updatePayload.bottom_banner = bottomBanner;
      if (cinemaLights !== undefined) updatePayload.cinema_lights = cinemaLights;

      await supabaseServer.from('room_config').upsert(updatePayload);

      // 2. Server-side authorized broadcast to all viewers
      const channel = supabaseServer.channel(roomId);
      if (videoUrl) {
        await channel.send({
          type: 'broadcast',
          event: 'evt',
          payload: {
            type: 'admin_video',
            videoId: videoUrl,
            senderName,
          },
        });
      }
      if (topBanner || bottomBanner) {
        await channel.send({
          type: 'broadcast',
          event: 'evt',
          payload: {
            type: 'admin_banners',
            topBanner: topBanner || '',
            bottomBanner: bottomBanner || '',
          },
        });
      }
      await supabaseServer.removeChannel(channel);
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

