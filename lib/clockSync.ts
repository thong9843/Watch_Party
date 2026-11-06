let cachedOffset = 0;
let isSyncing = false;

export async function syncServerTime(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  if (isSyncing) return cachedOffset;
  isSyncing = true;
  try {
    const t0 = Date.now();
    const res = await fetch('/api/time', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const t1 = Date.now();
      const roundTrip = t1 - t0;
      const serverTime = Number(data.time);
      if (!isNaN(serverTime)) {
        // Cristian's algorithm: serverTime - (t0 + t1)/2
        cachedOffset = serverTime - (t0 + roundTrip / 2);
      }
    }
  } catch {
    // Keep cached offset on network failure
  } finally {
    isSyncing = false;
  }
  return cachedOffset;
}

export function getServerTime(): number {
  return Date.now() + cachedOffset;
}

export function getClockOffset(): number {
  return cachedOffset;
}

