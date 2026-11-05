import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/adminAuth';
import { checkDbRateLimit } from '@/lib/dbRateLimit';

export async function GET(req: NextRequest) {
  try {
    const auth = requireAdmin(req);
    if (auth.errorResponse) {
      return auth.errorResponse;
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const allowed = await checkDbRateLimit(`admin_sugg:${ip}`, 10, 60);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Vượt quá giới hạn truy vấn (tối đa 10 lần/phút)' },
        { status: 429 }
      );
    }

    const roomId = req.nextUrl.searchParams.get('roomId') || 'room-cktg-1';
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    const memoryStore: any[] = (globalThis as any).__inMemorySuggestions || [];

    if (supabaseUrl && serviceRoleKey) {
      try {
        const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
        const { data, error } = await supabaseServer
          .from('video_suggestions')
          .select('*')
          .eq('room_id', roomId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(30);

        if (!error && data) {
          return NextResponse.json({ suggestions: data });
        }
      } catch {}
    }

    // Fallback to in-memory suggestions matching room
    const filtered = memoryStore.filter((s) => s.room_id === roomId && s.status === 'pending');
    return NextResponse.json({ suggestions: filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Lỗi server' }, { status: 500 });
  }
}

