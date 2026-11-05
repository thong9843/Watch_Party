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

/** 3D position of seat on flat floor (v2.2: all seats on y = 0, cushion y = 0.45) */
export function seatPos3D(seat: string): Vector3D {
  const parsed = parseSeat(seat);
  if (!parsed) return { x: 0, y: 0.45, z: 0 };
  const { row: r, col: c } = parsed;

  const baseZ = -3.2 + r * 2.8;

  // Symmetrical columns around X = 0 (Center Aisle width >= 1.8)
  // Seat spacing 1.25 units
  let x = 0;
  if (c < 5) {
    x = -1.3 - (4 - c) * 1.25;
  } else {
    x = 1.3 + (c - 5) * 1.25;
  }

  // Subtle curvature towards the screen
  const curveZ = (c - 4.5) * (c - 4.5) * 0.032;

  return {
    x,
    y: 0.45,
    z: baseZ + curveZ,
  };
}

/** AABB definitions for seat blocks (left & right block in each row) */
export interface SeatAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function getSeatRowAABBs(): SeatAABB[] {
  const boxes: SeatAABB[] = [];
  for (let r = 0; r < 6; r++) {
    const centerZ = -3.2 + r * 2.8;
    // Left seat block: seats 1-5 (x from -6.8 to -0.85)
    boxes.push({
      minX: -6.8,
      maxX: -0.85,
      minZ: centerZ - 0.48,
      maxZ: centerZ + 0.48,
    });
    // Right seat block: seats 6-10 (x from 0.85 to 6.8)
    boxes.push({
      minX: 0.85,
      maxX: 6.8,
      minZ: centerZ - 0.48,
      maxZ: centerZ + 0.48,
    });
  }
  return boxes;
}

const seatBlockAABBs = getSeatRowAABBs();

export function isInsideSeatBlock(x: number, z: number, ignoreSeatPos?: Vector3D | null): boolean {
  if (ignoreSeatPos && Math.hypot(x - ignoreSeatPos.x, z - ignoreSeatPos.z) < 0.45) {
    return false;
  }

  for (const box of seatBlockAABBs) {
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) {
      return true;
    }
  }
  return false;
}

/** Resolves an (x, z) point out of any seat block AABB to avoid getting stuck */
export function resolveOutOfAABB(x: number, z: number): { x: number; z: number } {
  let resX = x;
  let resZ = z;

  for (const box of seatBlockAABBs) {
    if (resX >= box.minX && resX <= box.maxX && resZ >= box.minZ && resZ <= box.maxZ) {
      const toMinX = Math.abs(resX - box.minX);
      const toMaxX = Math.abs(resX - box.maxX);
      const toMinZ = Math.abs(resZ - box.minZ);
      const toMaxZ = Math.abs(resZ - box.maxZ);

      const minDistance = Math.min(toMinX, toMaxX, toMinZ, toMaxZ);
      if (minDistance === toMaxZ) {
        resZ = box.maxZ + 0.25; // Push forward into row aisle
      } else if (minDistance === toMinZ) {
        resZ = box.minZ - 0.25; // Push backward
      } else if (minDistance === toMaxX) {
        resX = box.maxX + 0.25; // Push toward center aisle
      } else {
        resX = box.minX - 0.25; // Push toward side aisle
      }
    }
  }

  return { x: resX, z: resZ };
}

/** Generate waypoints for click-to-move navigation to a seat through aisles (flat floor y = 0) */
export function getPathToSeat(currentPos: { x: number; z: number }, targetSeat: string): Vector3D[] {
  const sPos = seatPos3D(targetSeat);
  const parsed = parseSeat(targetSeat);
  const rowZ = parsed ? -3.2 + parsed.row * 2.8 : sPos.z;
  const rowWalkingZ = rowZ + 0.8; // Walking lane in front of the row

  // Available aisles: Left (-8.2), Center (0.0), Right (+8.2)
  const isTargetLeft = sPos.x < 0;
  let targetAisleX = 0;
  if (isTargetLeft) {
    targetAisleX = currentPos.x < -4.5 ? -8.2 : 0.0;
  } else {
    targetAisleX = currentPos.x > 4.5 ? 8.2 : 0.0;
  }

  const waypoints: Vector3D[] = [];

  // 1. Move to nearest aisle from current pos
  waypoints.push({
    x: targetAisleX,
    y: 0,
    z: currentPos.z,
  });

  // 2. Move along aisle to target row walking lane
  waypoints.push({
    x: targetAisleX,
    y: 0,
    z: rowWalkingZ,
  });

  // 3. Move along row walking lane to seat X
  waypoints.push({
    x: sPos.x,
    y: 0,
    z: rowWalkingZ,
  });

  // 4. Step onto the seat cushion
  waypoints.push({
    x: sPos.x,
    y: sPos.y,
    z: sPos.z,
  });

  return waypoints;
}

/** 3D position of oxygen tank (base on floor against left wall at x = -10.8) */
export function tankPos3D(index: number): Vector3D {
  return {
    x: -10.8,
    y: 0,
    z: -4.5 + index * 2.4,
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
  const leftAisleX = -8.2;

  // Waypoints on flat floor y = 0
  const p1: Vector3D = { x: s.x, y: 0, z: s.z + 0.65 };
  const p2: Vector3D = { x: leftAisleX, y: 0, z: p1.z };
  const p3: Vector3D = { x: leftAisleX, y: 0, z: t.z };
  const p4: Vector3D = { x: t.x + 0.9, y: 0, z: t.z };

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

  // Inbound: reverse direction
  const inbound: Segment3D[] = [
    {
      p1: p4,
      p2: p3,
      duration: dur4,
      rotY: calcRotY(p4, p3),
    },
    {
      p1: p3,
      p2: p2,
      duration: dur3,
      rotY: calcRotY(p3, p2),
    },
    {
      p1: p2,
      p2: p1,
      duration: dur2,
      rotY: calcRotY(p2, p1),
    },
    {
      p1,
      p2: s,
      duration: FLOOR_TRANSITION_DURATION,
      rotY: calcRotY(p1, s),
    },
  ];

  const totalDuration =
    FLOOR_TRANSITION_DURATION +
    dur2 +
    dur3 +
    dur4 +
    BREATHE_DURATION +
    dur4 +
    dur3 +
    dur2 +
    FLOOR_TRANSITION_DURATION;

  return {
    outbound,
    breatheDuration: BREATHE_DURATION,
    inbound,
    totalDuration,
  };
}

export function oxygenState3D(
  seat: string,
  tank: number,
  elapsed: number
): { x: number; y: number; z: number; rotY: number; isBreathing: boolean; done: boolean } {
  const { outbound, breatheDuration, inbound, totalDuration } = getOxygenSegments3D(seat, tank);

  if (elapsed >= totalDuration) {
    const s = seatPos3D(seat);
    return { x: s.x, y: s.y, z: s.z, rotY: Math.PI, isBreathing: false, done: true };
  }

  // 1. Check outbound
  let curTime = 0;
  for (const seg of outbound) {
    if (elapsed < curTime + seg.duration) {
      const t = (elapsed - curTime) / seg.duration;
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * t,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * t,
        z: seg.p1.z + (seg.p2.z - seg.p1.z) * t,
        rotY: seg.rotY,
        isBreathing: false,
        done: false,
      };
    }
    curTime += seg.duration;
  }

  // 2. Check breathing at tank
  if (elapsed < curTime + breatheDuration) {
    const t = tankPos3D(tank);
    return {
      x: t.x + 0.9,
      y: 0,
      z: t.z,
      rotY: -Math.PI / 2, // Facing the left wall tank
      isBreathing: true,
      done: false,
    };
  }
  curTime += breatheDuration;

  // 3. Check inbound
  for (const seg of inbound) {
    if (elapsed < curTime + seg.duration) {
      const t = (elapsed - curTime) / seg.duration;
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * t,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * t,
        z: seg.p1.z + (seg.p2.z - seg.p1.z) * t,
        rotY: seg.rotY,
        isBreathing: false,
        done: false,
      };
    }
    curTime += seg.duration;
  }

  const s = seatPos3D(seat);
  return { x: s.x, y: s.y, z: s.z, rotY: Math.PI, isBreathing: false, done: true };
}

export function findBestOxygenTank3D(
  seat: string,
  occupiedTanks: Set<number>
): number | null {
  const s = seatPos3D(seat);
  let bestTank: number | null = null;
  let minCost = Infinity;

  for (let i = 0; i < TOTAL_TANKS; i++) {
    if (occupiedTanks.has(i)) continue;
    const t = tankPos3D(i);
    const cost = Math.abs(s.z - t.z);
    if (cost < minCost) {
      minCost = cost;
      bestTank = i;
    }
  }
  return bestTank;
}

// Backward-compat aliases
export const seatPos = seatPos3D;
export const tankPos = tankPos3D;
export const oxygenState = oxygenState3D;
export const findBestOxygenTank = findBestOxygenTank3D;
