import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import { checkDbRateLimit } from '@/lib/dbRateLimit';

export async function POST(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const allowed = await checkDbRateLimit(`admin_playback:${ip}`, 30, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Thao tác điều khiển video quá nhanh, vui lòng thử lại sau giây lát!' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      roomId = 'room-cktg-1',
      state, // 'playing' | 'paused'
      position, // number (seconds)
      isLive, // boolean
    } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const serverNow = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      playback_updated_at: serverNow,
      updated_at: serverNow,
      updated_by: 'Admin',
    };

    if (state === 'playing' || state === 'paused') {
      updatePayload.playback_state = state;
    }
    if (typeof position === 'number' && !isNaN(position) && position >= 0) {
      updatePayload.playback_position = position;
    }
    if (typeof isLive === 'boolean') {
      updatePayload.is_live = isLive;
    }

    if (supabaseUrl && serviceRoleKey) {
      const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
      const { error } = await supabaseServer
        .from('room_config')
        .update(updatePayload)
        .eq('room_id', roomId);

      if (error) {
        console.error('Supabase playback update error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        roomId,
        ...updatePayload,
      },
    });
  } catch (err: any) {
    console.error('Playback API error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi điều khiển phát video' }, { status: 500 });
  }
}

