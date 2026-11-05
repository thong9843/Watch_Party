'use server';

import crypto from 'crypto';

export async function verifyAdminKey(key: string | null): Promise<boolean> {
  const expectedKey = process.env.ADMIN_KEY?.trim();
  const providedKey = key?.trim();
  if (!expectedKey || !providedKey) return false;
  const a = Buffer.from(providedKey);
  const b = Buffer.from(expectedKey);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}