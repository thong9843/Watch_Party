// Seat collision test for all 112 seats (A1 to H14)
const {
  ROWS,
  COLS,
  ALL_SEATS,
  seatPos3D,
  isInsideSeatBlock,
  resolveOutOfAABB,
  getSeatRowAABBs,
} = require('../lib/layout.cjs');

function testCurrentStandUpLogic() {
  const stuckSeats = [];
  const directions = [
    { name: 'W (Forward/Screen)', dx: 0, dz: -1 },
    { name: 'S (Backward/Back)', dx: 0, dz: 1 },
    { name: 'A (Left)', dx: -1, dz: 0 },
    { name: 'D (Right)', dx: 1, dz: 0 },
  ];

  for (const seat of ALL_SEATS) {
    const s = seatPos3D(seat);

    // Current stand-up logic in Cinema3D.tsx:
    // targetZ = s.z - 1.1;
    // safe = resolveOutOfAABB(targetX, targetZ);
    const targetX = s.x;
    const targetZ = s.z - 1.1;
    let safe = resolveOutOfAABB(targetX, targetZ);

    // Test new stand-up logic: getSafeStandUpPos(seat)
    const { getSafeStandUpPos } = require('../lib/layout.cjs');
    const safePos = getSafeStandUpPos ? getSafeStandUpPos(seat) : safe;
    posX = safePos.x;
    posZ = safePos.z;

    // Check if initial stand-up spot is inside AABB
    if (isInsideSeatBlock(posX, posZ)) {
      stuckSeats.push({ seat, reason: 'Spawned inside AABB upon stand-up', posX, posZ });
      continue;
    }

    // Simulate pressing W, A, S, D for 1 second (60 frames @ 60fps, dt = 1/60s, speed = 6.2)
    let canMoveAnyDir = false;
    for (const dir of directions) {
      let simX = posX;
      let simZ = posZ;
      const moveSpeed = 6.2;
      const dt = 1 / 60;

      for (let f = 0; f < 60; f++) {
        const nextX = simX + dir.dx * moveSpeed * dt;
        const nextZ = simZ + dir.dz * moveSpeed * dt;
        if (!isInsideSeatBlock(nextX, simZ)) {
          simX = nextX;
        }
        if (!isInsideSeatBlock(simX, nextZ)) {
          simZ = nextZ;
        }
      }

      const movedDist = Math.hypot(simX - posX, simZ - posZ);
      if (movedDist > 0.5 && !isInsideSeatBlock(simX, simZ)) {
        canMoveAnyDir = true;
      }
    }

    if (!canMoveAnyDir) {
      stuckSeats.push({ seat, reason: 'Cannot move freely in any direction after stand-up', posX, posZ });
    }
  }

  return stuckSeats;
}

const stuck = testCurrentStandUpLogic();
console.log(`TOTAL SEATS TESTED: ${ALL_SEATS.length}`);
console.log(`STUCK SEATS: ${stuck.length}`);
if (stuck.length > 0) {
  console.log('Sample stuck seats:', stuck.slice(0, 10));
}
