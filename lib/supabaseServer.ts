import { createClient, SupabaseClient } from '@supabase/supabase-js';

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return typeof payload.role === 'string' ? payload.role : null;
  } catch {
    return null;
  }
}

export function isPublishableOrAnonKey(token: string, anonKey?: string): boolean {
  const trimmed = token.trim();
  if (anonKey && trimmed === anonKey.trim()) return true;
  if (trimmed.startsWith('sb_publishable_')) return true;
  if (decodeJwtRole(trimmed) === 'anon') return true;
  return false;
}

export function isValidServiceRoleKey(token: string): boolean {
  const trimmed = token.trim();
  if (trimmed.startsWith('sb_secret_')) return true;
  if (decodeJwtRole(trimmed) === 'service_role') return true;
  return false;
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

  // Detect publishable / anon key mistakenly assigned to SUPABASE_SERVICE_ROLE_KEY
  if (isPublishableOrAnonKey(serviceRoleKey, anonKey)) {
    return {
      client: null,
      error:
        'CẢNH BÁO CẤU HÌNH: SUPABASE_SERVICE_ROLE_KEY đang bị gán nhầm bằng Public/Publishable Key (sb_publishable_... hoặc anon JWT)! ' +
        'Hãy vào Supabase Dashboard -> Project Settings -> API -> copy đúng Secret Key (bắt đầu bằng "sb_secret_" hoặc JWT có role "service_role") ' +
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
      `Nguyên nhân: SUPABASE_SERVICE_ROLE_KEY trên Vercel có thể đang bị điền nhầm Public/Publishable Key (hãy đổi sang Service Role Key: sb_secret_... hoặc JWT service_role), ` +
      `hoặc cần chạy lệnh SQL: "GRANT ALL ON TABLE public.${table} TO service_role;" trong Supabase SQL Editor.`
    );
  }

  return msg;
}
