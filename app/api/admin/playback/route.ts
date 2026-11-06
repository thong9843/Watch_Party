import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/adminAuth';
import { checkDbRateLimit } from '@/lib/dbRateLimit';
import { getSupabaseAdmin, formatSupabaseError } from '@/lib/supabaseServer';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId') || 'room-cktg-1';

    const { client: supabaseServer, error: supabaseInitErr } = getSupabaseAdmin();
    if (supabaseInitErr || !supabaseServer) {
      return NextResponse.json(
        { error: supabaseInitErr || 'Máy chủ chưa cấu hình Supabase Server API' },
        { status: 500 }
      );
    }

    const { data: config, error } = await supabaseServer
      .from('room_config')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: formatSupabaseError(error, 'room_config') }, { status: 500 });
    }
    if (!config) {
      return NextResponse.json({ error: 'Không tìm thấy cấu hình phòng ' + roomId }, { status: 404 });
    }

    const serverNowMs = Date.now();
    const dbUpdatedMs = config.playback_updated_at
      ? new Date(config.playback_updated_at).getTime()
      : serverNowMs;
    const isPlaying = config.playback_state === 'playing';
    const cur = isPlaying
      ? (config.playback_position || 0) + (serverNowMs - dbUpdatedMs) / 1000
      : (config.playback_position || 0);

    return NextResponse.json({
      success: true,
      data: config,
      currentPosition: Math.max(0, cur),
      serverNow: serverNowMs,
    });
  } catch (err: any) {
    console.error('Playback GET error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi đọc trạng thái phát' }, { status: 500 });
  }
}

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
      action, // 'play' | 'pause' | 'seek' | 'seekBy' | 'setLive'
      position, // number (seconds)
      delta, // number (seconds for seekBy)
      isLive, // boolean
    } = body;

    const { client: supabaseServer, error: supabaseInitErr } = getSupabaseAdmin();
    if (supabaseInitErr || !supabaseServer) {
      return NextResponse.json(
        { error: supabaseInitErr || 'Máy chủ chưa cấu hình Supabase Server API' },
        { status: 500 }
      );
    }

    // 1. SELECT current room_config
    const { data: currentConfig, error: selectErr } = await supabaseServer
      .from('room_config')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (selectErr) {
      console.error('Supabase room_config select error:', selectErr);
      return NextResponse.json({ error: formatSupabaseError(selectErr, 'room_config') }, { status: 500 });
    }
    if (!currentConfig) {
      return NextResponse.json({ error: 'Không tìm thấy cấu hình phòng ' + roomId }, { status: 404 });
    }

    // 2. Compute current server-accurate playback position
    const serverNowMs = Date.now();
    const serverNowIso = new Date(serverNowMs).toISOString();
    const dbUpdatedMs = currentConfig.playback_updated_at
      ? new Date(currentConfig.playback_updated_at).getTime()
      : serverNowMs;
    const isPlaying = currentConfig.playback_state === 'playing';
    const cur = isPlaying
      ? (currentConfig.playback_position || 0) + (serverNowMs - dbUpdatedMs) / 1000
      : (currentConfig.playback_position || 0);

    let newPosition = Math.max(0, cur);
    let newState = currentConfig.playback_state || 'playing';
    let newIsLive = currentConfig.is_live ?? false;

    // 3. Apply action
    if (action === 'play') {
      newPosition = Math.max(0, cur);
      newState = 'playing';
    } else if (action === 'pause') {
      newPosition = Math.max(0, cur);
      newState = 'paused';
    } else if (action === 'seek') {
      newPosition = Math.max(0, typeof position === 'number' ? position : cur);
    } else if (action === 'seekBy') {
      newPosition = Math.max(0, cur + (Number(delta) || 0));
    } else if (action === 'setLive') {
      newIsLive = Boolean(isLive);
    }

    const updatePayload: Record<string, any> = {
      playback_state: newState,
      playback_position: newPosition,
      playback_updated_at: serverNowIso,
      is_live: newIsLive,
      updated_at: serverNowIso,
      updated_by: 'Admin',
    };

    // 4. Update room_config and return fresh record
    let { data: updatedRecord, error: updateErr } = await supabaseServer
      .from('room_config')
      .update(updatePayload)
      .eq('room_id', roomId)
      .select()
      .single();

    // Fallback if playback columns do not exist yet in schema
    if (updateErr && (updateErr.message?.includes('playback_') || updateErr.code === 'PGRST204')) {
      const fallbackPayload = {
        updated_at: serverNowIso,
        updated_by: 'Admin',
      };
      const retry = await supabaseServer
        .from('room_config')
        .update(fallbackPayload)
        .eq('room_id', roomId)
        .select()
        .single();
      updateErr = retry.error;
      updatedRecord = retry.data ? { ...retry.data, ...updatePayload } : null;
    }

    if (updateErr) {
      console.error('Supabase playback update error:', updateErr);
      return NextResponse.json({ error: formatSupabaseError(updateErr, 'room_config') }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data: updatedRecord || { roomId, ...updatePayload },
    });
  } catch (err: any) {
    console.error('Playback API error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi điều khiển phát video' }, { status: 500 });
  }
}
