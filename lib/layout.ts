export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
export const COLS = 10;
export const TOTAL_TANKS = 7;
export const BREATHE_DURATION = 6000; // ms
export const FLOOR_TRANSITION_DURATION = 450; // ms
export const CRAWL_SPEED_3D = 0.005; // 3D units per ms (~5 units/s)

export const ALL_SEATS: string[] = ROWS.flatMap((r) =>
  Array.from({ length: COLS }, (_, c) => `${r}${c + 1}`)
);

export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

export function parseSeat(seat: string): { row: number; col: number } | null {
  const r = seat.charAt(0).toUpperCase();
  const c = parseInt(seat.slice(1), 10);
  const rowIndex = ROWS.indexOf(r as (typeof ROWS)[number]);
  if (rowIndex === -1 || isNaN(c) || c < 1 || c > COLS) return null;
  return { row: rowIndex, col: c - 1 };
}

/** 3D position of seat (point on top of seat cushion) */
export function seatPos3D(seat: string): Vector3D {
  const parsed = parseSeat(seat);
  if (!parsed) return { x: 0, y: 0.5, z: 0 };
  const { row: r, col: c } = parsed;

  const y = 0.4 + r * 0.45;
  const baseZ = -3.0 + r * 2.5;

  // Symmetrical columns around X = 0 (Center Aisle between col 4 & 5)
  let x = 0;
  if (c < 5) {
    x = -0.75 - (4 - c) * 1.1;
  } else {
    x = 0.75 + (c - 5) * 1.1;
  }

  // Subtle curvature towards the screen
  const curveZ = (c - 4.5) * (c - 4.5) * 0.035;

  return {
    x,
    y: y + 0.35,
    z: baseZ + curveZ,
  };
}

/** 3D position of oxygen tank (base on floor) */
export function tankPos3D(index: number): Vector3D {
  return {
    x: -8.8,
    y: 0,
    z: -4.0 + index * 2.2,
  };
}

interface Segment3D {
  p1: Vector3D;
  p2: Vector3D;
  duration: number;
  rotY: number;
}

function dist3D(a: Vector3D, b: Vector3D): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function calcRotY(from: Vector3D, to: Vector3D): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export function getOxygenSegments3D(seat: string, tank: number): {
  outbound: Segment3D[];
  breatheDuration: number;
  inbound: Segment3D[];
  totalDuration: number;
} {
  const s = seatPos3D(seat);
  const t = tankPos3D(tank);
  const leftAisleX = -7.2;

  // Waypoints:
  // p0: on seat
  // p1: step onto row floor in front of seat
  const p1: Vector3D = { x: s.x, y: s.y - 0.35, z: s.z + 0.55 };
  // p2: along row to left aisle
  const p2: Vector3D = { x: leftAisleX, y: p1.y, z: p1.z };
  // p3: along left aisle down to tank z and ground level
  const p3: Vector3D = { x: leftAisleX, y: 0, z: t.z };
  // p4: beside tank
  const p4: Vector3D = { x: t.x + 0.8, y: 0, z: t.z };

  const seg1: Segment3D = {
    p1: s,
    p2: p1,
    duration: FLOOR_TRANSITION_DURATION,
    rotY: calcRotY(s, p1),
  };

  const dur2 = Math.max(250, dist3D(p1, p2) / CRAWL_SPEED_3D);
  const seg2: Segment3D = {
    p1,
    p2,
    duration: dur2,
    rotY: calcRotY(p1, p2),
  };

  const dur3 = Math.max(250, dist3D(p2, p3) / CRAWL_SPEED_3D);
  const seg3: Segment3D = {
    p1: p2,
    p2: p3,
    duration: dur3,
    rotY: calcRotY(p2, p3),
  };

  const dur4 = Math.max(250, dist3D(p3, p4) / CRAWL_SPEED_3D);
  const seg4: Segment3D = {
    p1: p3,
    p2: p4,
    duration: dur4,
    rotY: calcRotY(p3, p4),
  };

  const outbound = [seg1, seg2, seg3, seg4];

  // Inbound is exact reverse
  const inSeg4: Segment3D = {
    p1: p4,
    p2: p3,
    duration: dur4,
    rotY: calcRotY(p4, p3),
  };

  const inSeg3: Segment3D = {
    p1: p3,
    p2,
    duration: dur3,
    rotY: calcRotY(p3, p2),
  };

  const inSeg2: Segment3D = {
    p1: p2,
    p2: p1,
    duration: dur2,
    rotY: calcRotY(p2, p1),
  };

  const inSeg1: Segment3D = {
    p1,
    p2: s,
    duration: FLOOR_TRANSITION_DURATION,
    rotY: calcRotY(p1, s),
  };

  const inbound = [inSeg4, inSeg3, inSeg2, inSeg1];

  const outDur = outbound.reduce((acc, seg) => acc + seg.duration, 0);
  const inDur = inbound.reduce((acc, seg) => acc + seg.duration, 0);
  const totalDuration = outDur + BREATHE_DURATION + inDur;

  return { outbound, breatheDuration: BREATHE_DURATION, inbound, totalDuration };
}

export function oxygenState3D(
  seat: string,
  tank: number,
  elapsed: number
): {
  x: number;
  y: number;
  z: number;
  pose: 'crawl' | 'breathe';
  rotY: number;
  done: boolean;
} {
  const { outbound, breatheDuration, inbound, totalDuration } = getOxygenSegments3D(seat, tank);
  const s = seatPos3D(seat);

  if (elapsed >= totalDuration) {
    return { x: s.x, y: s.y, z: s.z, pose: 'crawl', rotY: Math.PI, done: true };
  }

  let t = Math.max(0, elapsed);

  // Outbound crawling
  for (const seg of outbound) {
    if (t <= seg.duration) {
      const p = seg.duration > 0 ? t / seg.duration : 1;
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * p,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * p,
        z: seg.p1.z + (seg.p2.z - seg.p1.z) * p,
        pose: 'crawl',
        rotY: seg.rotY,
        done: false,
      };
    }
    t -= seg.duration;
  }

  // Breathing at tank
  const tBeside = { x: tankPos3D(tank).x + 0.8, y: 0, z: tankPos3D(tank).z };
  if (t <= breatheDuration) {
    return {
      x: tBeside.x,
      y: tBeside.y,
      z: tBeside.z,
      pose: 'breathe',
      rotY: -Math.PI / 2, // Facing tank on the left
      done: false,
    };
  }
  t -= breatheDuration;

  // Inbound crawling
  for (const seg of inbound) {
    if (t <= seg.duration) {
      const p = seg.duration > 0 ? t / seg.duration : 1;
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * p,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * p,
        z: seg.p1.z + (seg.p2.z - seg.p1.z) * p,
        pose: 'crawl',
        rotY: seg.rotY,
        done: false,
      };
    }
    t -= seg.duration;
  }

  return { x: s.x, y: s.y, z: s.z, pose: 'crawl', rotY: Math.PI, done: true };
}

export function findBestOxygenTank3D(seat: string, occupiedTanks: Set<number>): number | null {
  const s = seatPos3D(seat);
  let bestTank: number | null = null;
  let minDiff = Infinity;

  for (let i = 0; i < TOTAL_TANKS; i++) {
    if (occupiedTanks.has(i)) continue;
    const t = tankPos3D(i);
    const diff = Math.abs(t.z - s.z);
    if (diff < minDiff) {
      minDiff = diff;
      bestTank = i;
    }
  }

  return bestTank;
}

// Backward-compatible aliases for legacy imports
export const oxygenState = oxygenState3D;
export const seatPos = seatPos3D;
export const tankPos = tankPos3D;
export const findBestOxygenTank = findBestOxygenTank3D;
