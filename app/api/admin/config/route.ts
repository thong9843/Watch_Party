import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import { checkDbRateLimit } from '@/lib/dbRateLimit';
import { extractYouTubeId } from '@/lib/youtube';

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

    let cleanVideoId: string | undefined;
    if (videoUrl !== undefined) {
      const parsed = extractYouTubeId(String(videoUrl));
      if (!parsed) {
        return NextResponse.json({ error: 'Link hoặc Video ID YouTube không hợp lệ' }, { status: 400 });
      }
      cleanVideoId = parsed;
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabaseServer = createClient(supabaseUrl, serviceRoleKey);

      // Update room_config table (Client receives update via postgres_changes)
      const serverNow = new Date().toISOString();
      const updatePayload: Record<string, any> = {
        updated_at: serverNow,
        updated_by: senderName,
      };
      if (cleanVideoId !== undefined) {
        updatePayload.video_url = cleanVideoId;
        // Spec V3.1: Đổi video mới: reset position = 0, state = playing
        updatePayload.playback_position = 0;
        updatePayload.playback_state = 'playing';
        updatePayload.playback_updated_at = serverNow;
      }
      if (topBanner !== undefined) updatePayload.top_banner = topBanner;
      if (bottomBanner !== undefined) updatePayload.bottom_banner = bottomBanner;
      if (cinemaLights !== undefined) updatePayload.cinema_lights = cinemaLights;

      const { data: existing, error: selectErr } = await supabaseServer
        .from('room_config')
        .select('room_id')
        .eq('room_id', roomId)
        .maybeSingle();

      if (selectErr) {
        console.error('Supabase room_config select error:', selectErr);
        return NextResponse.json({ error: selectErr.message }, { status: 500 });
      }

      let { error } = existing
        ? await supabaseServer.from('room_config').update(updatePayload).eq('room_id', roomId)
        : await supabaseServer.from('room_config').insert({
            room_id: roomId,
            video_url: cleanVideoId || process.env.NEXT_PUBLIC_YT_VIDEO_ID || 'jfKfPfyJRdk',
            ...updatePayload,
          });

      // Fallback: Nếu database Supabase chưa chạy migration các cột playback_* mới
      if (error && (error.message?.includes('playback_') || error.code === 'PGRST204')) {
        console.warn('Cột playback_* chưa có trong bảng room_config, fallback cập nhật không có playback');
        const fallbackPayload = { ...updatePayload };
        delete fallbackPayload.playback_position;
        delete fallbackPayload.playback_state;
        delete fallbackPayload.playback_updated_at;

        const retry = existing
          ? await supabaseServer.from('room_config').update(fallbackPayload).eq('room_id', roomId)
          : await supabaseServer.from('room_config').insert({
              room_id: roomId,
              video_url: cleanVideoId || process.env.NEXT_PUBLIC_YT_VIDEO_ID || 'jfKfPfyJRdk',
              ...fallbackPayload,
            });
        error = retry.error;
      }

      if (error) {
        console.error('Supabase room_config write error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Cập nhật cấu hình phòng thành công!',
      data: { roomId, videoUrl: cleanVideoId ?? videoUrl, topBanner, bottomBanner, cinemaLights },
    });
  } catch (err: any) {
    console.error('Server Admin Config Error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý yêu cầu' }, { status: 500 });
  }
}
