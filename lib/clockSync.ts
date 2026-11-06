let cachedOffset = 0;
let isSyncing = false;

export async function syncServerTime(): Promise<number> {
  if (typeof window === 'undefined') return 0;
  if (isSyncing) return cachedOffset;
  isSyncing = true;
  try {
    const samples: Array<{ rtt: number; offset: number }> = [];
    // Measure 3 samples, pick the one with lowest RTT (Cristian's algorithm)
    for (let i = 0; i < 3; i++) {
      try {
        const t0 = Date.now();
        const res = await fetch('/api/time', { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const t1 = Date.now();
          const rtt = t1 - t0;
          const serverTime = Number(data.time);
          if (!isNaN(serverTime)) {
            const offset = serverTime - (t0 + rtt / 2);
            samples.push({ rtt, offset });
          }
        }
      } catch {
        // Skip failed single sample
      }
    }

    if (samples.length > 0) {
      samples.sort((a, b) => a.rtt - b.rtt);
      cachedOffset = samples[0].offset;
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
