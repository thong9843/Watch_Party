// ============================================================================
// ROOM ARCHITECTURE & DIMENSIONS (V2.3.1: COMPACT CINEMA & 112 SEATS)
// ============================================================================

export const ROOM_HALF_W = 17.0; // Left/Right Wall: X in [-17, 17] (Width 34m)
export const ROOM_FRONT_Z = -20.0; // Front Wall / Screen Z
export const ROOM_BACK_Z = 19.5; // Back Wall / Entrance Z (~10m behind row H at Z = 9.6)
export const CEILING_Y = 22.0; // Ceiling height

export const SCREEN_W = 28.0; // Screen width (16:9 ratio)
export const SCREEN_H = 15.75; // Screen height (16:9 ratio)
export const SCREEN_BOTTOM_Y = 4.0; // Bottom of screen above flat floor
export const SCREEN_CENTER_Y = 11.875; // 4.0 + 15.75 / 2 = 11.875
export const SCREEN_Z = -20.0;

// Seats: 8 rows (A-H) x 14 columns = 112 seats
// 2 blocks of 7 seats, center aisle 2.0m wide (X in [-1.0, 1.0])
// Seats block occupies ~70% of floor width (~23.8m / 34m)
export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const COLS = 14;
export const ROW_A_Z = -10.0; // Row A is 10m from the 28m screen
export const ROW_SPACING = 2.8;
export const SEAT_SPACING = 1.6;
export const CENTER_AISLE_HALF_W = 1.0; // Center aisle width = 2.0m
export const TOTAL_SEATS = ROWS.length * COLS; // 112 seats

// Spawn position: immediately behind the last row H (Z = 9.6) at Z = 10.5
export const SPAWN_POS = { x: 0.0, y: 0.0, z: 10.5 };

// 8 Oxygen Tanks along Left Wall at X = -17.0
export const OXYGEN_WALL_X = -17.0;
export const OXYGEN_LEFT_AISLE_X = -14.2; // Left walkway for walking/crawling to oxygen
export const RIGHT_AISLE_X = 14.2; // Right walkway
export const TOTAL_TANKS = 8;
export const BREATHE_DURATION = 6000; // ms
export const FLOOR_TRANSITION_DURATION = 350; // ms
export const CRAWL_SPEED_3D = 0.0075; // ~7.5 units/s

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

/** 3D position of seat cushion center on flat floor y = 0 */
export function seatPos3D(seat: string): Vector3D {
  const parsed = parseSeat(seat);
  if (!parsed) return { x: 0, y: 0.45, z: 0 };
  const { row: r, col: c } = parsed;

  const baseZ = ROW_A_Z + r * ROW_SPACING;

  // 2 blocks of 7 seats with center aisle 2.0m (X between -1.0 and +1.0)
  // Left block: c = 0..6 (seats 1-7), inner seat at X = -1.8, outer at X = -11.4
  // Right block: c = 7..13 (seats 8-14), inner seat at X = +1.8, outer at X = +11.4
  let x = 0;
  if (c < 7) {
    x = -1.8 - (6 - c) * SEAT_SPACING;
  } else {
    x = 1.8 + (c - 7) * SEAT_SPACING;
  }

  // Subtle curvature towards the screen
  const curveZ = (c - 6.5) * (c - 6.5) * 0.012;

  return {
    x,
    y: 0.45,
    z: baseZ + curveZ,
  };
}

/** AABB definitions for seat blocks (left & right block in each of the 8 rows) */
export interface SeatAABB {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export function getSeatRowAABBs(): SeatAABB[] {
  const boxes: SeatAABB[] = [];
  for (let r = 0; r < ROWS.length; r++) {
    const centerZ = ROW_A_Z + r * ROW_SPACING;
    // Left seat block: seats 1-7 (x from -12.4 to -1.0)
    boxes.push({
      minX: -12.4,
      maxX: -1.0,
      minZ: centerZ - 0.55,
      maxZ: centerZ + 0.55,
    });
    // Right seat block: seats 8-14 (x from 1.0 to 12.4)
    boxes.push({
      minX: 1.0,
      maxX: 12.4,
      minZ: centerZ - 0.55,
      maxZ: centerZ + 0.55,
    });
  }
  return boxes;
}

const seatBlockAABBs = getSeatRowAABBs();

export function isInsideSeatBlock(x: number, z: number, ignoreSeatPos?: Vector3D | null): boolean {
  if (ignoreSeatPos && Math.hypot(x - ignoreSeatPos.x, z - ignoreSeatPos.z) < 0.55) {
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
      if (minDistance === toMinZ) {
        // Push forward toward row aisle (towards screen -Z)
        resZ = box.minZ - 0.35;
      } else if (minDistance === toMaxZ) {
        // Push backward
        resZ = box.maxZ + 0.35;
      } else if (minDistance === toMaxX) {
        // Push toward center aisle
        resX = box.maxX + 0.35;
      } else {
        // Push toward side aisle
        resX = box.minX - 0.35;
      }
    }
  }

  return { x: resX, z: resZ };
}

/** Generate waypoints for click-to-move navigation to a seat through aisles */
export function getPathToSeat(currentPos: { x: number; z: number }, targetSeat: string): Vector3D[] {
  const sPos = seatPos3D(targetSeat);
  const parsed = parseSeat(targetSeat);
  const rowZ = parsed ? ROW_A_Z + parsed.row * ROW_SPACING : sPos.z;
  const rowWalkingZ = rowZ - 1.0; // Walking lane IN FRONT of the row (towards screen -Z)

  // Available aisles: Left (-14.2), Center (0.0), Right (+14.2)
  const isTargetLeft = sPos.x < 0;
  let targetAisleX = 0;
  if (isTargetLeft) {
    targetAisleX = currentPos.x < -6.0 ? OXYGEN_LEFT_AISLE_X : 0.0;
  } else {
    targetAisleX = currentPos.x > 6.0 ? RIGHT_AISLE_X : 0.0;
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

/** 3D position of oxygen tank (base on floor against left wall at x = -17.0) */
export function tankPos3D(index: number): Vector3D {
  return {
    x: OXYGEN_WALL_X,
    y: 0,
    z: ROW_A_Z + index * 2.8,
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
  const leftAisleX = OXYGEN_LEFT_AISLE_X;

  // Waypoints on flat floor y = 0
  // Character gets up towards screen (-Z into row walking lane)
  const p1: Vector3D = { x: s.x, y: 0, z: s.z - 1.0 };
  const p2: Vector3D = { x: leftAisleX, y: 0, z: p1.z };
  const p3: Vector3D = { x: leftAisleX, y: 0, z: t.z };
  const p4: Vector3D = { x: t.x + 1.2, y: 0, z: t.z };

  const seg1: Segment3D = {
    p1: s,
    p2: p1,
    duration: FLOOR_TRANSITION_DURATION,
    rotY: calcRotY(s, p1),
  };

  const dur2 = Math.max(200, dist3D(p1, p2) / CRAWL_SPEED_3D);
  const seg2: Segment3D = {
    p1,
    p2,
    duration: dur2,
    rotY: calcRotY(p1, p2),
  };

  const dur3 = Math.max(200, dist3D(p2, p3) / CRAWL_SPEED_3D);
  const seg3: Segment3D = {
    p1: p2,
    p2: p3,
    duration: dur3,
    rotY: calcRotY(p2, p3),
  };

  const dur4 = Math.max(200, dist3D(p3, p4) / CRAWL_SPEED_3D);
  const seg4: Segment3D = {
    p1: p3,
    p2: p4,
    duration: dur4,
    rotY: calcRotY(p3, p4),
  };

  const outbound = [seg1, seg2, seg3, seg4];

  // Inbound: reverse direction back to seat
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
      x: t.x + 1.2,
      y: 0,
      z: t.z,
      rotY: -Math.PI / 2, // Facing left wall tank
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

/**
 * Single source of truth for resolving active video ID.
 * Priority: Query param ?v= > roomVideoId (presence/broadcast) > localStorage > env / default
 */
export function resolveVideoId(roomVideoId?: string | null, envDefault?: string): string {
  if (typeof window !== 'undefined') {
    const qv = new URLSearchParams(window.location.search).get('v');
    if (qv && qv.trim()) {
      return qv.trim();
    }
  }
  if (roomVideoId && roomVideoId.trim()) {
    return roomVideoId.trim();
  }
  if (typeof window !== 'undefined') {
    const stored = localStorage.getItem('cinema_room_video_id');
    if (stored && stored.trim()) {
      return stored.trim();
    }
  }
  if (envDefault && envDefault.trim()) {
    return envDefault.trim();
  }
  return 'jfKfPfyJRdk';
}

