'use server';

export async function verifyAdminKey(key: string | null): Promise<boolean> {
  const expectedKey = process.env.ADMIN_KEY;
  if (!expectedKey || !key) return false;
  return key === expectedKey;
}