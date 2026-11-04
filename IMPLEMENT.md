# IMPLEMENT.md — Esports Watch Party 3D (Spec v2)

> **Nguồn sự thật (Single Source of Truth) cho bản 3D v2.**
> Cập nhật toàn bộ kiến trúc từ 2D lên 3D không gian rạp chiếu phim, nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách tương tác một chạm Sansa Temple.

---

## 0. Tiến độ Nâng cấp Bản 3D v2
- [x] **P1 Setup Port 3002 & R3F Stack**: Ghim cố định phiên bản `three@0.174.0`, `@react-three/fiber@9.0.4`, `@react-three/drei@10.7.9`, `zustand@5.0.3`.
- [x] **P2 Khán phòng 3D đối xứng & Màn chiếu 16:9**: Màn chiếu cong 16×9 đơn vị với khung viền phát sáng + rèm nhung đỏ, nhúng CSS3D `<Html transform>` YouTube không giật; 6 dãy A–F × 10 ghế đối xứng qua trục giữa bằng `InstancedMesh` (giảm tối đa draw call); 7 bình oxi dọc tường trái.
- [x] **P3 Nhân vật Chibi 3D & Di chuyển tự do**: Low-poly Chibi 3D (đầu to, thân đổi màu theo user), điều khiển tự do (WASD / click-to-move lên sàn / joystick ảo mobile).
- [x] **P4 Tương tác ghế Sansa Temple & Đồng bộ vị trí**: Chạm ghế trống → nhân vật tự đi theo waypoint lối đi tới ghế và ngồi xuống; tới gần (< 1.5 đơn vị) hiện gợi ý "Nhấn E / Chạm để ngồi"; bấm E hoặc "Đứng dậy" để rời ghế.
- [x] **P5 Action 3D & Camera góc nhìn thứ 3**: Gáy bẩn (ưỡn ngực scale 1.25), Hò hét (rung lắc), SIUUU (nhảy xoay 360° + pháo giấy instanced particles 3D); Camera theo sau mượt mà, xoay/zoom, tự lia góc qua vai khi ngồi, phím `C` xem thẳng màn chiếu, toggle "🎥 Theo dõi hành động người khác".
- [x] **P6 Thở oxi 3D theo Waypoint**: Bò khỏi ghế → bò ra lối đi bên trái → tới bình oxi gần nhất → đeo mặt nạ + ống thở 3D Quadratic Bezier Curve → thở 6s → bò về ghế. Giữ chỗ realtime.
- [x] **P7 Tối ưu hiệu năng 60fps & Giới hạn 60 người/phòng**: `dpr={[1, 1.75]}`, bóng đổ 1 directional light (shadow map 1024), `<PerformanceMonitor>`, hiển thị hàng chờ khi kín 60 ghế, hỗ trợ `?debug=1` để bật FPS stats.
- [x] **P8 Fix triệt để Re-render React theo frame (Zero Re-render)**:
  - Local player tọa độ lưu vào `localPosRef` & `localRotRef` (`lib/playerRefs.ts`), cập nhật trực tiếp `group.position` trong `useFrame`.
  - Remote players lưu vào `remotePlayersMap`, nhận gói `pos` ghi thẳng vào Map, không gọi `set()` của Zustand.
  - `Cinema3D`, `Seats3D`, `CameraController` đọc ref trực tiếp, không subscribe `localPos`.
  - Giảm broadcast vị trí: chỉ gửi khi di chuyển > 0.05 / xoay > 0.05 rad, tối đa 10 lần/giây, gửi 1 gói khi dừng; ngồi/thở oxi không gửi pos; làm tròn 2 số thập phân.
  - Độ cao liên tục `getContinuousHeight(z)` khớp dãy ghế, damp mượt mà.
  - Va chạm ghế: chặn đi xuyên 12 khối ghế bằng AABB, click-to-move điều hướng qua lối đi.

---

## 1. Mục tiêu & Phạm vi v2 (3D)
- Web xem chung trận LMHT CKTG (nguồn YouTube Live) trong **rạp chiếu phim 3D**.
- Nhân vật Chibi 3D góc nhìn thứ 3, đi lại tự do trong khán phòng, click-to-move chạm vào ghế để tự đi tới ngồi.
- Giữ nguyên toàn bộ cơ chế realtime: Supabase Realtime (Broadcast + Presence) + fallback `BroadcastChannel` local mode cho nhiều tab.
- Port mặc định: **3002** (`http://localhost:3002`).

---

## 2. Tech Stack (3D v2)
| Thành phần | Công nghệ | Phiên bản (Ghim cố định) |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | `next@15.2.1`, `react@19.0.0` |
| 3D Engine | Three.js + React Three Fiber + Drei | `three@0.174.0`, `@react-three/fiber@9.0.4`, `@react-three/drei@10.7.9` |
| High-freq State | Zustand + Shared Three Refs (`playerRefs.ts`) | `zustand@5.0.3` |
| Styling | CSS thuần `app/globals.css` (không Tailwind, không thư viện UI ngoài) | CSS3 thuần |
| Realtime | `@supabase/supabase-js` (Presence + Broadcast, không cần tạo bảng) | `@supabase/supabase-js@2.49.1` |
| Fallback | `BroadcastChannel` cho tab cùng trình duyệt khi thiếu env Supabase | Chuẩn Web API |
| Âm thanh | Web Audio API tự tổng hợp (sawtooth glide, bandpass noise, triangle, hiss) | Web Audio API |
| Deploy | Vercel ready (`reactStrictMode: false`) | Port 3002 |

---

## 3. Cấu trúc File (3D v2)
```
app/
  layout.tsx         # Root layout, metadata & viewport
  page.tsx           # Entry page: JoinScreen -> 3D Room, parse ?v= và ?room=
  globals.css        # Toàn bộ CSS thuần cho rạp 3D, UI overlays, action bar, joystick
lib/
  types.ts           # Data model: Member, ActionType, RoomEvent, PlayerPosUpdate
  layout.ts          # Tọa độ 3D: seatPos3D, tankPos3D, AABB ghế, getPathToSeat, waypoint thở oxi 3D
  playerRefs.ts      # Shared Three.js refs & RemotePlayers Map (triệt tiêu re-render per frame)
  realtime.ts        # Lớp kết nối realtime (Supabase / BroadcastChannel multi-room)
  store.ts           # Zustand store cho discrete states: isMoving, isSeated, camera, joystick
  sfx.ts             # Web Audio API tổng hợp âm thanh (gà gáy, hò hét, SIUU, pop, oxi)
components/
  JoinScreen.tsx      # Màn hình chọn nickname & màu áo nhân vật
  Room.tsx           # Container chính: Header, Canvas 3D, ActionBar, Joystick, Queue
  Cinema3D.tsx       # Three.js Canvas: Sàn, bậc thang, đèn chiếu, local/remote characters
  Screen3D.tsx       # Màn chiếu 3D 16:9 với CSS3D YouTube iframe + nút Về LIVE
  Seats3D.tsx        # 60 ghế khán phòng đối xứng dùng InstancedMesh (1-2 draw calls)
  OxygenTanks3D.tsx  # 7 bình oxi dọc tường trái + biển neon 3D
  Character3D.tsx    # Chibi 3D (LocalCharacter3D & RemoteCharacter3D đọc ref trong useFrame)
  CameraController.tsx # Camera 3rd person damping, zoom action, phím C màn chiếu
  VirtualJoystick.tsx # Cần điều khiển cảm ứng cho mobile
.env.example
package.json
tsconfig.json
README.md
```

---

## 4. Nguyên Tắc Hiệu Năng Bắt Buộc (60fps & Zero Re-render)
1. **Triệt tiêu hoàn toàn Re-render React mỗi frame**:
   - Vị trí và góc quay của Local Player lưu trong `localPosRef` & `localRotRef` (`lib/playerRefs.ts`). Trong `useFrame`, biến đổi trực tiếp vector Three.js mà không gọi `setLocalPos`.
   - Vị trí của Remote Players lưu trong `remotePlayersMap`. Nhận gói tin `pos` qua websocket chỉ cập nhật Map trong bộ nhớ, tuyệt đối không trigger React state của component cha.
   - `Cinema3D`, `Seats3D`, `CameraController` đọc ref trực tiếp trong `useFrame`. Số lần re-render của `Cinema3D` khi nhân vật chạy hoặc nhiều người cùng di chuyển là **0 lần/giây**.
2. **InstancedMesh cho 60 ghế**: Toàn bộ đệm và lưng ghế của 60 vị trí được gộp render qua 2 `InstancedMesh`, giữ draw call ở mức tối thiểu.
3. **Giảm thiểu tải mạng Broadcast**:
   - Chỉ gửi gói tin vị trí khi nhân vật thực sự di chuyển hoặc độ lệch > 0.05 đơn vị / góc > 0.05 rad.
   - Giới hạn tần số tối đa 10 gói/giây (khoảng cách >= 100ms).
   - Khi dừng di chuyển, gửi 1 gói duy nhất (`isMoving: false`) rồi dừng hẳn.
   - Khi ngồi ghế hoặc thở oxi: hoàn toàn không gửi broadcast vị trí (đã có trạng thái bền vững trong Presence).
   - Tọa độ làm tròn 2 chữ số thập phân (`Math.round(val * 100) / 100`) giúp payload siêu nhẹ.
4. **Độ cao liên tục & Chống xuyên ghế**:
   - Độ cao sàn khán phòng được nội suy mượt mà qua hàm `getContinuousHeight(z)` kết hợp damping `MathUtils.damp`.
   - Hệ thống AABB bao quanh 12 khối ghế tự động ngăn cản người chơi đi xuyên qua hàng ghế. Khi click vào ghế trống, thuật toán `getPathToSeat` tạo chuỗi waypoint dẫn đường qua lối đi và rẽ vào ghế an toàn.
5. **Adaptive DPR & Shadow tối ưu**:
   - Chỉ dùng 1 `directionalLight` đổ bóng với shadow map `1024×1024`.
   - Sử dụng `<PerformanceMonitor>` để tự động điều chỉnh tỉ lệ pixel giữa `1.0` và `1.75` tùy theo cấu hình thiết bị.
