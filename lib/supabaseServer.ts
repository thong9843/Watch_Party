import { createClient, SupabaseClient } from '@supabase/supabase-js';

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload.role || null;
  } catch {
    return null;
  }
}

export function getSupabaseAdmin(): { client: SupabaseClient | null; error?: string } {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      client: null,
      error: 'Máy chủ chưa cấu hình biến môi trường SUPABASE_SERVICE_ROLE_KEY (hoặc NEXT_PUBLIC_SUPABASE_URL)!',
    };
  }

  // Detect if user accidentally assigned the anon (public) key to SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey === anonKey || decodeJwtRole(serviceRoleKey) === 'anon') {
    return {
      client: null,
      error:
        'CẢNH BÁO CẤU HÌNH: SUPABASE_SERVICE_ROLE_KEY đang bị gán nhầm bằng Anon Key (Public Key)! ' +
        'Hãy vào Supabase Dashboard -> Project Settings -> API -> copy đúng key "service_role" (Secret) ' +
        'và dán vào biến SUPABASE_SERVICE_ROLE_KEY trên Vercel / server rồi Redeploy.',
    };
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return { client };
}

export function formatSupabaseError(error: any, table: string = 'room_config'): string {
  if (!error) return 'Lỗi cơ sở dữ liệu không xác định';
  const msg: string = error.message || String(error);

  if (msg.includes('permission denied') || error.code === '42501') {
    return (
      `Lỗi phân quyền Supabase (${msg}): Bảng ${table} từ chối quyền ghi. ` +
      `Nguyên nhân: SUPABASE_SERVICE_ROLE_KEY trên Vercel có thể đang bị điền nhầm Anon Key (hãy đổi sang Service Role Key), ` +
      `hoặc cần chạy lệnh SQL: "GRANT ALL ON TABLE public.${table} TO service_role;" trong Supabase SQL Editor.`
    );
  }

  return msg;
}

