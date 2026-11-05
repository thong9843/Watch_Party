import { createClient } from '@supabase/supabase-js';

// Fallback in-memory rate limiter when database RPC is unavailable
const memoryRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkMemoryRateLimit(key: string, limit: number, windowSeconds: number): boolean {
  const now = Date.now();
  const record = memoryRateLimitMap.get(key);
  if (!record || now > record.resetAt) {
    memoryRateLimitMap.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return true;
  }
  if (record.count >= limit) {
    return false;
  }
  record.count++;
  return true;
}

/**
 * Atomic database rate limiter using Supabase RPC `check_rate_limit`.
 * Falls back to in-memory window limiter if database is offline.
 *
 * @param key Unique rate limit key (e.g. `admin:192.168.1.1`, `chat:127.0.0.1`)
 * @param limit Max allowed requests within window
 * @param windowSeconds Window length in seconds
 * @returns true if request is allowed, false if rate limited (429)
 */
export async function checkDbRateLimit(
  key: string,
  limit: number,
  windowSeconds: number
): Promise<boolean> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    try {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      const { data, error } = await supabase.rpc('check_rate_limit', {
        p_key: key,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });

      if (!error && typeof data === 'boolean') {
        return data;
      }
      if (error) {
        console.warn('[RateLimit] Database RPC error, falling back to memory:', error.message);
      }
    } catch (err) {
      console.warn('[RateLimit] Database connection error, falling back to memory:', err);
    }
  }

  return checkMemoryRateLimit(key, limit, windowSeconds);
}

