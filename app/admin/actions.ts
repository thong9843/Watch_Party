'use server';

export async function verifyAdminKey(key: string | null): Promise<boolean> {
  const expectedKey = process.env.ADMIN_KEY || 'admin123';
  if (!key) return false;
  return key === expectedKey;
}
