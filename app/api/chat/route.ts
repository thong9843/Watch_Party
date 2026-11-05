import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkDbRateLimit } from '@/lib/dbRateLimit';
import { filterBadWords } from '@/lib/badwords';

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1';
    const allowed = await checkDbRateLimit(`chat:${ip}`, 1, 1);
    if (!allowed) {
      return NextResponse.json(
        { error: 'Gửi chat quá nhanh (tối đa 1 tin/giây). Vui lòng đợi!' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { roomId = 'room-cktg-1', senderId = 'anonymous', senderName = 'Khán giả', message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'Nội dung tin nhắn không hợp lệ' }, { status: 400 });
    }

    const trimmed = message.trim().slice(0, 60);
    if (!trimmed) {
      return NextResponse.json({ error: 'Tin nhắn không được để trống' }, { status: 400 });
    }

    const cleanMessage = filterBadWords(trimmed);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (supabaseUrl && serviceRoleKey) {
      const supabaseServer = createClient(supabaseUrl, serviceRoleKey);
      await supabaseServer.from('chat_log').insert({
        room_id: roomId,
        sender_id: senderId,
        sender_name: String(senderName).slice(0, 30),
        message: cleanMessage,
      });
    }

    return NextResponse.json({
      success: true,
      message: cleanMessage,
    });
  } catch (err: any) {
    console.error('Chat API Error:', err);
    return NextResponse.json({ error: err.message || 'Lỗi xử lý chat' }, { status: 500 });
  }
}

