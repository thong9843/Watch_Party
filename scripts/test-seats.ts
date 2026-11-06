// Automated test for all 112 seats stand-up safety & collision boundaries
import {
  ALL_SEATS,
  seatPos3D,
  isInsideSeatBlock,
  getSafeStandUpPos,
  getSeatRowAABBs,
  resolveOutOfAABB,
  ROOM_FRONT_Z,
  ROOM_BACK_Z,
} from '../lib/layout';

console.log('--- KIỂM TRA ĐO THẬT 112 GHẾ RẠP CHIẾU (A1 -> H14) ---');

interface StuckReport {
  seat: string;
  reason: string;
  pos: { x: number; z: number };
}

const stuckSeats: StuckReport[] = [];
const directions = [
  { name: 'W (Hướng màn chiếu -Z)', dx: 0, dz: -0.2 },
  { name: 'S (Hướng cửa vào +Z)', dx: 0, dz: 0.2 },
  { name: 'A (Sang trái -X)', dx: -0.2, dz: 0 },
  { name: 'D (Sang phải +X)', dx: 0.2, dz: 0 },
];

for (const seat of ALL_SEATS) {
  const sPos = seatPos3D(seat);
  const standPos = getSafeStandUpPos(seat);

  // 1. Kiểm tra vị trí đứng dậy có bị kẹt ngay trong khối AABB ghế không
  const isInside = isInsideSeatBlock(standPos.x, standPos.z);
  if (isInside) {
    stuckSeats.push({
      seat,
      reason: 'Spawn rơi trực tiếp vào trong hộp va chạm AABB của ghế',
      pos: { x: standPos.x, z: standPos.z },
    });
    continue;
  }

  // 2. Kiểm tra vị trí có nằm ngoài biên phòng chiếu không
  if (standPos.z < ROOM_FRONT_Z + 1.0 || standPos.z > ROOM_BACK_Z - 1.0) {
    stuckSeats.push({
      seat,
      reason: 'Spawn vượt ra ngoài tường phòng chiếu',
      pos: { x: standPos.x, z: standPos.z },
    });
    continue;
  }

  // 3. Kiểm tra khả năng di chuyển (WASD không bị khóa cứng toàn bộ 4 hướng)
  let freeDirections = 0;
  for (const dir of directions) {
    const nextX = standPos.x + dir.dx;
    const nextZ = standPos.z + dir.dz;
    if (!isInsideSeatBlock(nextX, nextZ)) {
      freeDirections++;
    }
  }

  if (freeDirections === 0) {
    stuckSeats.push({
      seat,
      reason: 'Bị bao vây 4 phía không thể di chuyển theo bất kỳ hướng nào',
      pos: { x: standPos.x, z: standPos.z },
    });
  }
}

console.log(`TỔNG SỐ GHẾ KIỂM TRA: ${ALL_SEATS.length}`);
console.log(`SỐ GHẾ BỊ KẸT: ${stuckSeats.length}`);

if (stuckSeats.length === 0) {
  console.log('>>> KẾT QUẢ: 100% GHẾ (112/112) ĐỨNG DẬY AN TOÀN, 0 LỖI KẸT! <<<');
  process.exit(0);
} else {
  console.error('Danh sách ghế bị lỗi:');
  console.error(stuckSeats);
  process.exit(1);
}
