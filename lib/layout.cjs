"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var layout_exports = {};
__export(layout_exports, {
  ALL_SEATS: () => ALL_SEATS,
  BREATHE_DURATION: () => BREATHE_DURATION,
  CEILING_Y: () => CEILING_Y,
  CENTER_AISLE_HALF_W: () => CENTER_AISLE_HALF_W,
  COLS: () => COLS,
  CRAWL_SPEED_3D: () => CRAWL_SPEED_3D,
  FLOOR_TRANSITION_DURATION: () => FLOOR_TRANSITION_DURATION,
  OXYGEN_LEFT_AISLE_X: () => OXYGEN_LEFT_AISLE_X,
  OXYGEN_WALL_X: () => OXYGEN_WALL_X,
  RIGHT_AISLE_X: () => RIGHT_AISLE_X,
  ROOM_BACK_Z: () => ROOM_BACK_Z,
  ROOM_FRONT_Z: () => ROOM_FRONT_Z,
  ROOM_HALF_W: () => ROOM_HALF_W,
  ROWS: () => ROWS,
  ROW_A_Z: () => ROW_A_Z,
  ROW_SPACING: () => ROW_SPACING,
  SCREEN_BOTTOM_Y: () => SCREEN_BOTTOM_Y,
  SCREEN_CENTER_Y: () => SCREEN_CENTER_Y,
  SCREEN_H: () => SCREEN_H,
  SCREEN_W: () => SCREEN_W,
  SCREEN_Z: () => SCREEN_Z,
  SEAT_SPACING: () => SEAT_SPACING,
  SPAWN_POS: () => SPAWN_POS,
  TOTAL_SEATS: () => TOTAL_SEATS,
  TOTAL_TANKS: () => TOTAL_TANKS,
  findBestOxygenTank: () => findBestOxygenTank,
  findBestOxygenTank3D: () => findBestOxygenTank3D,
  getOxygenSegments3D: () => getOxygenSegments3D,
  getPathToSeat: () => getPathToSeat,
  getSafeStandUpPos: () => getSafeStandUpPos,
  getSeatRowAABBs: () => getSeatRowAABBs,
  isInsideSeatBlock: () => isInsideSeatBlock,
  oxygenState: () => oxygenState,
  oxygenState3D: () => oxygenState3D,
  parseSeat: () => parseSeat,
  resolveOutOfAABB: () => resolveOutOfAABB,
  resolveVideoId: () => resolveVideoId,
  seatPos: () => seatPos,
  seatPos3D: () => seatPos3D,
  tankPos: () => tankPos,
  tankPos3D: () => tankPos3D
});
module.exports = __toCommonJS(layout_exports);
const ROOM_HALF_W = 17;
const ROOM_FRONT_Z = -20;
const ROOM_BACK_Z = 19.5;
const CEILING_Y = 22;
const SCREEN_W = 28;
const SCREEN_H = 15.75;
const SCREEN_BOTTOM_Y = 4;
const SCREEN_CENTER_Y = 11.875;
const SCREEN_Z = -20;
const ROWS = ["A", "B", "C", "D", "E", "F", "G", "H"];
const COLS = 14;
const ROW_A_Z = -10;
const ROW_SPACING = 2.8;
const SEAT_SPACING = 1.6;
const CENTER_AISLE_HALF_W = 1;
const TOTAL_SEATS = ROWS.length * COLS;
const SPAWN_POS = { x: 0, y: 0, z: 10.5 };
const OXYGEN_WALL_X = -17;
const OXYGEN_LEFT_AISLE_X = -14.2;
const RIGHT_AISLE_X = 14.2;
const TOTAL_TANKS = 8;
const BREATHE_DURATION = 6e3;
const FLOOR_TRANSITION_DURATION = 350;
const CRAWL_SPEED_3D = 75e-4;
const ALL_SEATS = ROWS.flatMap(
  (r) => Array.from({ length: COLS }, (_, c) => `${r}${c + 1}`)
);
function parseSeat(seat) {
  const r = seat.charAt(0).toUpperCase();
  const c = parseInt(seat.slice(1), 10);
  const rowIndex = ROWS.indexOf(r);
  if (rowIndex === -1 || isNaN(c) || c < 1 || c > COLS) return null;
  return { row: rowIndex, col: c - 1 };
}
function seatPos3D(seat) {
  const parsed = parseSeat(seat);
  if (!parsed) return { x: 0, y: 0.45, z: 0 };
  const { row: r, col: c } = parsed;
  const baseZ = ROW_A_Z + r * ROW_SPACING;
  let x = 0;
  if (c < 7) {
    x = -1.8 - (6 - c) * SEAT_SPACING;
  } else {
    x = 1.8 + (c - 7) * SEAT_SPACING;
  }
  const curveZ = (c - 6.5) * (c - 6.5) * 0.012;
  return {
    x,
    y: 0.45,
    z: baseZ + curveZ
  };
}
function getSeatRowAABBs() {
  const boxes = [];
  for (let r = 0; r < ROWS.length; r++) {
    const centerZ = ROW_A_Z + r * ROW_SPACING;
    boxes.push({
      minX: -12.2,
      maxX: -1.1,
      minZ: centerZ - 0.45,
      maxZ: centerZ + 0.95
    });
    boxes.push({
      minX: 1.1,
      maxX: 12.2,
      minZ: centerZ - 0.45,
      maxZ: centerZ + 0.95
    });
  }
  return boxes;
}
const seatBlockAABBs = getSeatRowAABBs();
function isInsideSeatBlock(x, z, ignoreSeatPos) {
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
function resolveOutOfAABB(x, z) {
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
        resZ = box.minZ - 0.35;
      } else if (minDistance === toMaxZ) {
        resZ = box.maxZ + 0.35;
      } else if (minDistance === toMaxX) {
        resX = box.maxX + 0.35;
      } else {
        resX = box.minX - 0.35;
      }
    }
  }
  return { x: resX, z: resZ };
}
function getSafeStandUpPos(seat) {
  const s = seatPos3D(seat);
  const candidate1 = { x: s.x, y: 0, z: s.z - 1.6 };
  if (!isInsideSeatBlock(candidate1.x, candidate1.z) && candidate1.z >= ROOM_FRONT_Z + 1.2) {
    return candidate1;
  }
  const candidate2 = { x: s.x, y: 0, z: s.z + 1.6 };
  if (!isInsideSeatBlock(candidate2.x, candidate2.z) && candidate2.z <= ROOM_BACK_Z - 1.2) {
    return candidate2;
  }
  const aisles = [OXYGEN_LEFT_AISLE_X, 0, RIGHT_AISLE_X];
  let nearestAisleX = aisles[0];
  let minDist = Math.abs(s.x - aisles[0]);
  for (const ax of aisles) {
    const d = Math.abs(s.x - ax);
    if (d < minDist) {
      minDist = d;
      nearestAisleX = ax;
    }
  }
  const candidate3 = { x: nearestAisleX, y: 0, z: s.z };
  const safe = resolveOutOfAABB(candidate3.x, candidate3.z);
  return { x: safe.x, y: 0, z: safe.z };
}
function getPathToSeat(currentPos, targetSeat) {
  const sPos = seatPos3D(targetSeat);
  const parsed = parseSeat(targetSeat);
  const rowZ = parsed ? ROW_A_Z + parsed.row * ROW_SPACING : sPos.z;
  const rowWalkingZ = rowZ - 1;
  const isTargetLeft = sPos.x < 0;
  let targetAisleX = 0;
  if (isTargetLeft) {
    targetAisleX = currentPos.x < -6 ? OXYGEN_LEFT_AISLE_X : 0;
  } else {
    targetAisleX = currentPos.x > 6 ? RIGHT_AISLE_X : 0;
  }
  const waypoints = [];
  waypoints.push({
    x: targetAisleX,
    y: 0,
    z: currentPos.z
  });
  waypoints.push({
    x: targetAisleX,
    y: 0,
    z: rowWalkingZ
  });
  waypoints.push({
    x: sPos.x,
    y: 0,
    z: rowWalkingZ
  });
  waypoints.push({
    x: sPos.x,
    y: sPos.y,
    z: sPos.z
  });
  return waypoints;
}
function tankPos3D(index) {
  return {
    x: OXYGEN_WALL_X,
    y: 0,
    z: ROW_A_Z + index * 2.8
  };
}
function dist3D(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}
function calcRotY(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}
function getOxygenSegments3D(seat, tank) {
  const s = seatPos3D(seat);
  const t = tankPos3D(tank);
  const leftAisleX = OXYGEN_LEFT_AISLE_X;
  const p1 = { x: s.x, y: 0, z: s.z - 1 };
  const p2 = { x: leftAisleX, y: 0, z: p1.z };
  const p3 = { x: leftAisleX, y: 0, z: t.z };
  const p4 = { x: t.x + 1.2, y: 0, z: t.z };
  const seg1 = {
    p1: s,
    p2: p1,
    duration: FLOOR_TRANSITION_DURATION,
    rotY: calcRotY(s, p1)
  };
  const dur2 = Math.max(200, dist3D(p1, p2) / CRAWL_SPEED_3D);
  const seg2 = {
    p1,
    p2,
    duration: dur2,
    rotY: calcRotY(p1, p2)
  };
  const dur3 = Math.max(200, dist3D(p2, p3) / CRAWL_SPEED_3D);
  const seg3 = {
    p1: p2,
    p2: p3,
    duration: dur3,
    rotY: calcRotY(p2, p3)
  };
  const dur4 = Math.max(200, dist3D(p3, p4) / CRAWL_SPEED_3D);
  const seg4 = {
    p1: p3,
    p2: p4,
    duration: dur4,
    rotY: calcRotY(p3, p4)
  };
  const outbound = [seg1, seg2, seg3, seg4];
  const inbound = [
    {
      p1: p4,
      p2: p3,
      duration: dur4,
      rotY: calcRotY(p4, p3)
    },
    {
      p1: p3,
      p2,
      duration: dur3,
      rotY: calcRotY(p3, p2)
    },
    {
      p1: p2,
      p2: p1,
      duration: dur2,
      rotY: calcRotY(p2, p1)
    },
    {
      p1,
      p2: s,
      duration: FLOOR_TRANSITION_DURATION,
      rotY: calcRotY(p1, s)
    }
  ];
  const totalDuration = FLOOR_TRANSITION_DURATION + dur2 + dur3 + dur4 + BREATHE_DURATION + dur4 + dur3 + dur2 + FLOOR_TRANSITION_DURATION;
  return {
    outbound,
    breatheDuration: BREATHE_DURATION,
    inbound,
    totalDuration
  };
}
function oxygenState3D(seat, tank, elapsed) {
  const { outbound, breatheDuration, inbound, totalDuration } = getOxygenSegments3D(seat, tank);
  if (elapsed >= totalDuration) {
    const s2 = seatPos3D(seat);
    return { x: s2.x, y: s2.y, z: s2.z, rotY: Math.PI, isBreathing: false, done: true };
  }
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
        done: false
      };
    }
    curTime += seg.duration;
  }
  if (elapsed < curTime + breatheDuration) {
    const t = tankPos3D(tank);
    return {
      x: t.x + 1.2,
      y: 0,
      z: t.z,
      rotY: -Math.PI / 2,
      // Facing left wall tank
      isBreathing: true,
      done: false
    };
  }
  curTime += breatheDuration;
  for (const seg of inbound) {
    if (elapsed < curTime + seg.duration) {
      const t = (elapsed - curTime) / seg.duration;
      return {
        x: seg.p1.x + (seg.p2.x - seg.p1.x) * t,
        y: seg.p1.y + (seg.p2.y - seg.p1.y) * t,
        z: seg.p1.z + (seg.p2.z - seg.p1.z) * t,
        rotY: seg.rotY,
        isBreathing: false,
        done: false
      };
    }
    curTime += seg.duration;
  }
  const s = seatPos3D(seat);
  return { x: s.x, y: s.y, z: s.z, rotY: Math.PI, isBreathing: false, done: true };
}
function findBestOxygenTank3D(seat, occupiedTanks) {
  const s = seatPos3D(seat);
  let bestTank = null;
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
const seatPos = seatPos3D;
const tankPos = tankPos3D;
const oxygenState = oxygenState3D;
const findBestOxygenTank = findBestOxygenTank3D;
function resolveVideoId(roomVideoId, envDefault) {
  if (typeof window !== "undefined") {
    const qv = new URLSearchParams(window.location.search).get("v");
    if (qv && qv.trim()) {
      return qv.trim();
    }
  }
  if (roomVideoId && roomVideoId.trim()) {
    return roomVideoId.trim();
  }
  if (envDefault && envDefault.trim()) {
    return envDefault.trim();
  }
  return "jfKfPfyJRdk";
}
