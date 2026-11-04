export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const COLS = 10;
export const AISLE_X = 178;
export const CRAWL_SPEED = 0.16; // units / ms
export const BREATHE_DURATION = 6000; // ms
export const FLOOR_TRANSITION_DURATION = 450; // ms
export const TOTAL_TANKS = 7;

export const ALL_SEATS: string[] = ROWS.flatMap((r) =>
  Array.from({ length: COLS }, (_, c) => `${r}${c + 1}`)
);

export function parseSeat(seat: string): { row: number; col: number } | null {
  const r = seat.charAt(0).toUpperCase();
  const c = parseInt(seat.slice(1), 10);
  const rowIndex = ROWS.indexOf(r as (typeof ROWS)[number]);
  if (rowIndex === -1 || isNaN(c) || c < 1 || c > COLS) return null;
  return { row: rowIndex, col: c - 1 };
}

export function seatPos(seat: string): { x: number; y: number } {
  const parsed = parseSeat(seat);
  if (!parsed) return { x: 262, y: 92 };
  return {
    x: 262 + parsed.col * 68,
    y: 92 + parsed.row * 86,
  };
}

export function tankPos(index: number): { x: number; y: number } {
  return {
    x: 64,
    y: 82 + index * 76,
  };
}

interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  duration: number;
  dir: -1 | 1;
}

export function getOxygenSegments(seat: string, tank: number): {
  outbound: Segment[];
  breatheDuration: number;
  inbound: Segment[];
  totalDuration: number;
} {
  const s = seatPos(seat);
  const t = tankPos(tank);
  const tBeside = { x: t.x + 58, y: t.y };

  // Outbound
  // Seg 1: Seat -> Floor
  const seg1: Segment = {
    x1: s.x,
    y1: s.y,
    x2: s.x,
    y2: s.y + 34,
    duration: FLOOR_TRANSITION_DURATION,
    dir: -1,
  };

  // Seg 2: Floor -> Aisle
  const dist2 = Math.abs(AISLE_X - s.x);
  const dur2 = Math.max(200, dist2 / CRAWL_SPEED);
  const seg2: Segment = {
    x1: s.x,
    y1: s.y + 34,
    x2: AISLE_X,
    y2: s.y + 34,
    duration: dur2,
    dir: -1,
  };

  // Seg 3: Aisle to tank y
  const dist3 = Math.abs(t.y - (s.y + 34));
  const dur3 = Math.max(200, dist3 / CRAWL_SPEED);
  const seg3: Segment = {
    x1: AISLE_X,
    y1: s.y + 34,
    x2: AISLE_X,
    y2: t.y,
    duration: dur3,
    dir: -1,
  };

  // Seg 4: Aisle to beside tank
  const dist4 = Math.abs(tBeside.x - AISLE_X);
  const dur4 = Math.max(200, dist4 / CRAWL_SPEED);
  const seg4: Segment = {
    x1: AISLE_X,
    y1: t.y,
    x2: tBeside.x,
    y2: tBeside.y,
    duration: dur4,
    dir: -1,
  };

  const outbound = [seg1, seg2, seg3, seg4];

  // Inbound (reversed)
  const inSeg4: Segment = {
    x1: tBeside.x,
    y1: tBeside.y,
    x2: AISLE_X,
    y2: t.y,
    duration: dur4,
    dir: 1,
  };

  const inSeg3: Segment = {
    x1: AISLE_X,
    y1: t.y,
    x2: AISLE_X,
    y2: s.y + 34,
    duration: dur3,
    dir: 1,
  };

  const inSeg2: Segment = {
    x1: AISLE_X,
    y1: s.y + 34,
    x2: s.x,
    y2: s.y + 34,
    duration: dur2,
    dir: 1,
  };

  const inSeg1: Segment = {
    x1: s.x,
    y1: s.y + 34,
    x2: s.x,
    y2: s.y,
    duration: FLOOR_TRANSITION_DURATION,
    dir: 1,
  };

  const inbound = [inSeg4, inSeg3, inSeg2, inSeg1];

  const outDur = outbound.reduce((sum, seg) => sum + seg.duration, 0);
  const inDur = inbound.reduce((sum, seg) => sum + seg.duration, 0);
  const totalDuration = outDur + BREATHE_DURATION + inDur;

  return { outbound, breatheDuration: BREATHE_DURATION, inbound, totalDuration };
}

export function oxygenState(
  seat: string,
  tank: number,
  elapsed: number
): {
  x: number;
  y: number;
  pose: 'crawl' | 'breathe';
  dir: -1 | 1;
  done: boolean;
} {
  const { outbound, breatheDuration, inbound, totalDuration } = getOxygenSegments(seat, tank);
  const s = seatPos(seat);

  if (elapsed >= totalDuration) {
    return { x: s.x, y: s.y, pose: 'crawl', dir: 1, done: true };
  }

  let t = Math.max(0, elapsed);

  // Check outbound segments
  for (const seg of outbound) {
    if (t <= seg.duration) {
      const p = seg.duration > 0 ? t / seg.duration : 1;
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * p,
        y: seg.y1 + (seg.y2 - seg.y1) * p,
        pose: 'crawl',
        dir: seg.dir,
        done: false,
      };
    }
    t -= seg.duration;
  }

  // Check breathing
  const tBeside = { x: tankPos(tank).x + 58, y: tankPos(tank).y };
  if (t <= breatheDuration) {
    return {
      x: tBeside.x,
      y: tBeside.y,
      pose: 'breathe',
      dir: -1,
      done: false,
    };
  }
  t -= breatheDuration;

  // Check inbound segments
  for (const seg of inbound) {
    if (t <= seg.duration) {
      const p = seg.duration > 0 ? t / seg.duration : 1;
      return {
        x: seg.x1 + (seg.x2 - seg.x1) * p,
        y: seg.y1 + (seg.y2 - seg.y1) * p,
        pose: 'crawl',
        dir: seg.dir,
        done: false,
      };
    }
    t -= seg.duration;
  }

  return { x: s.x, y: s.y, pose: 'crawl', dir: 1, done: true };
}

export function findBestOxygenTank(seat: string, occupiedTanks: Set<number>): number | null {
  const s = seatPos(seat);
  let bestTank: number | null = null;
  let minDiff = Infinity;

  for (let i = 0; i < TOTAL_TANKS; i++) {
    if (occupiedTanks.has(i)) continue;
    const t = tankPos(i);
    const diff = Math.abs(t.y - s.y);
    if (diff < minDiff) {
      minDiff = diff;
      bestTank = i;
    }
  }

  return bestTank;
}

