import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkDbRateLimit } from '@/lib/dbRateLimit';
import { extractYouTubeId } from '@/lib/youtube';

interface SuggestionItem {
  id: string;
  room_id: string;
  video_url: string;
  title: string | null;
  suggested_by: string;
  status: string;
  created_at: string;
}

const memoryStore: SuggestionItem[] =
  (globalThis as any).__inMemorySuggestions || ((globalThis as any).__inMemorySuggestions = []);

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const allowed = await checkDbRateLimit(`suggest:${ip}`, 3, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Bạn gửi đề xuất quá nhanh (tối đa 3 lần / phút). Vui lòng đợi!' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const {
      roomId = 'room-cktg-1',
      videoUrl,
      title = null,
      suggestedBy = 'Khán giả',
      senderName,
    } = body;

    const ytId = extractYouTubeId(videoUrl);
    if (!ytId) {
      return NextResponse.json(
        { error: 'Link YouTube hoặc Video ID không hợp lệ' },
        { status: 400 }
      );
    }

    const name = String(suggestedBy || senderName || 'Khán giả').slice(0, 30);
    const item: SuggestionItem = {
      id: 'sug_' + Math.random().toString(36).substring(2, 9),
      room_id: roomId,
      video_url: ytId,
      title: title ? String(title).slice(0, 100) : null,
      suggested_by: name,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let dbSuccess = false;
    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
        const { error } = await supabaseServer.from('video_suggestions').insert({
          room_id: roomId,
          video_url: ytId,
          title: item.title,
          suggested_by: name,
          status: 'pending',
        });
        if (!error) {
          dbSuccess = true;
        } else {
          console.warn('Database video_suggestions insert fallback to memory:', error.message);
        }
      } catch (e: any) {
        console.warn('Database video_suggestions insert error, fallback to memory:', e.message);
      }
    }

    // Always keep in memory store as cache / fallback
    memoryStore.unshift(item);
    if (memoryStore.length > 50) memoryStore.pop();

    return NextResponse.json({
      success: true,
      message: 'Đã gửi đề xuất video tới Admin thành công!',
      suggestion: item,
      persistedIn: dbSuccess ? 'database' : 'memory',
    });
  } catch (err: any) {
    console.error('Suggest Video Error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý đề xuất' }, { status: 500 });
  }
}

