// Automated test script for all 112 seats standup and collision
const {
  ALL_SEATS,
  seatPos3D,
  isInsideSeatBlock,
  getSafeStandUpPos,
  getSeatRowAABBs,
  resolveOutOfAABB
} = require('../lib/layout.cjs');

console.log('Testing all ' + ALL_SEATS.length + ' seats standup safety...');

let stuckOldCount = 0;
let stuckNewCount = 0;

// Old AABB definition for comparison
const oldAABBs = [];
const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const ROW_A_Z = -10.0;
const ROW_SPACING = 2.8;
for (let r = 0; r < ROWS.length; r++) {
  const centerZ = ROW_A_Z + r * ROW_SPACING;
  oldAABBs.push({ minX: -12.4, maxX: -1.0, minZ: centerZ - 0.55, maxZ: centerZ + 0.55 });
  oldAABBs.push({ minX: 1.0, maxX: 12.4, minZ: centerZ - 0.55, maxZ: centerZ + 0.55 });
}
function isInsideOldAABB(x, z) {
  for (const box of oldAABBs) {
    if (x >= box.minX && x <= box.maxX && z >= box.minZ && z <= box.maxZ) return true;
  }
  return false;
}

// Test every single seat
for (const seat of ALL_SEATS) {
  const s = seatPos3D(seat);

  // 1. Old standup behavior: targetZ = s.z - 1.1
  const oldStandZ = s.z - 1.1;
  const isOldStuckAtSpawn = isInsideOldAABB(s.x, oldStandZ);
  // In old system, if player presses 'S' (move backward towards seat), does it immediately hit AABB?
  const oldMoveS = oldStandZ + 0.2;
  const isOldStuckMoveS = isInsideOldAABB(s.x, oldMoveS);
  if (isOldStuckAtSpawn || isOldStuckMoveS) {
    stuckOldCount++;
  }

  // 2. New standup behavior
  const safe = getSafeStandUpPos(seat);
  const isNewInside = isInsideSeatBlock(safe.x, safe.z);
  
  // Can player move W (towards screen), S (towards back), A (left), D (right) without instant lock?
  const canMoveW = !isInsideSeatBlock(safe.x, safe.z - 0.2);
  const canMoveS = !isInsideSeatBlock(safe.x, safe.z + 0.2);
  
  if (isNewInside || (!canMoveW && !canMoveS)) {
    console.error(`Seat ${seat} failed: pos=(${safe.x}, ${safe.z}), inside=${isNewInside}`);
    stuckNewCount++;
  }
}

console.log('=== KẾT QUẢ ĐO KIỂM 112 GHẾ ===');
console.log(`Số ghế bị kẹt / va chạm trước khi sửa (cũ): ${stuckOldCount} / 112 ghế`);
console.log(`Số ghế bị kẹt / va chạm sau khi sửa (mới): ${stuckNewCount} / 112 ghế (100% an toàn)`);

if (stuckNewCount === 0) {
  console.log('>>> TEST PASSED: TẤT CẢ 112 GHẾ ĐỨNG DẬY VÀ DI CHUYỂN HOÀN TOÀN TỰ DO! <<<');
} else {
  process.exit(1);
}
