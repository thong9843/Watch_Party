# IMPLEMENT.md — Esports Watch Party 3D (Spec v2)

> **Nguồn sự thật (Single Source of Truth) cho bản 3D v2.**
> Cập nhật toàn bộ kiến trúc từ 2D lên 3D không gian rạp chiếu phim, nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách tương tác một chạm Sansa Temple.

---

## 0. Tiến độ Nâng cấp Bản 3D v2
- [x] **P1 Setup Port 3002 & R3F Stack**: Pinned `three@^0.174.0`, `@react-three/fiber@^9.0.4`, `@react-three/drei@^10.7.9`, `zustand@^5.0.3`.
- [x] **P2 Khán phòng 3D đối xứng & Màn chiếu 16:9**: Màn chiếu cong 16×9 đơn vị với khung viền phát sáng + rèm nhung đỏ, nhúng CSS3D `<Html transform>` YouTube không giật; 6 dãy A–F × 10 ghế đối xứng qua trục giữa bằng `InstancedMesh` (giảm tối đa draw call); 7 bình oxi dọc tường trái.
- [x] **P3 Nhân vật Chibi 3D & Di chuyển tự do**: Low-poly Chibi 3D (đầu to, thân đổi màu theo user), điều khiển tự do (WASD / click-to-move lên sàn / joystick ảo mobile).
- [x] **P4 Tương tác ghế Sansa Temple & Đồng bộ vị trí**: Chạm ghế trống → nhân vật tự đi tới và ngồi xuống; tới gần (< 1.5 đơn vị) hiện gợi ý "Nhấn E / Chạm để ngồi"; bấm E hoặc "Đứng dậy" để rời ghế; broadcast vị trí 10–15 lần/giây + nội suy lerp/damp 60fps mượt mà.
- [x] **P5 Action 3D & Camera góc nhìn thứ 3**: Gáy bẩn (ưỡn ngực scale 1.25), Hò hét (rung lắc), SIUUU (nhảy xoay 360° + pháo giấy instanced particles 3D); Camera theo sau mượt mà, xoay/zoom, tự lia góc qua vai khi ngồi, phím `C` xem thẳng màn chiếu, toggle "🎥 Theo dõi hành động người khác".
- [x] **P6 Thở oxi 3D theo Waypoint**: Bò khỏi ghế → bò ra lối đi bên trái → tới bình oxi gần nhất → đeo mặt nạ + ống thở 3D Quadratic Bezier Curve → thở 6s → bò về ghế. Giữ chỗ realtime.
- [x] **P7 Tối ưu hiệu năng 60fps & Giới hạn 60 người/phòng**: `dpr={[1, 1.75]}`, bóng đổ 1 directional light (shadow map 1024), `<PerformanceMonitor>`, hiển thị hàng chờ khi kín 60 ghế, hỗ trợ `?debug=1` để bật FPS stats.

---

## 1. Mục tiêu & Phạm vi v2 (3D)
- Web xem chung trận LMHT CKTG (nguồn YouTube Live) trong **rạp chiếu phim 3D**.
- Nhân vật Chibi 3D góc nhìn thứ 3, đi lại tự do trong khán phòng, click-to-move chạm vào ghế để tự đi tới ngồi.
- Giữ nguyên toàn bộ cơ chế realtime: Supabase Realtime (Broadcast + Presence) + fallback `BroadcastChannel` local mode cho nhiều tab.
- Port mặc định: **3002** (`http://localhost:3002`).

---

## 2. Tech Stack (3D v2)
| Thành phần | Công nghệ | Phiên bản |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | `next@^15.2.1`, `react@^19.0.0` |
| 3D Engine | Three.js + React Three Fiber + Drei | `three@^0.174.0`, `@react-three/fiber@^9.0.4`, `@react-three/drei@^10.7.9` |
| High-freq State | Zustand (quản lý vị trí di chuyển, camera, joystick) | `zustand@^5.0.3` |
| Styling | CSS thuần `app/globals.css` (không Tailwind, không thư viện UI bên ngoài) | CSS3 thuần |
| Realtime | `@supabase/supabase-js` (Presence + Broadcast, không cần tạo bảng) | `@supabase/supabase-js@^2.49.1` |
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
  layout.ts          # Tọa độ 3D: seatPos3D, tankPos3D, waypoint thở oxi 3D
  realtime.ts        # Lớp kết nối realtime (Supabase / BroadcastChannel multi-room)
  store.ts           # Zustand store cho 60fps input, camera và remote players
  sfx.ts             # Web Audio API tổng hợp âm thanh (gà gáy, hò hét, SIUU, pop, oxi)
components/
  JoinScreen.tsx      # Màn hình chọn nickname & màu áo nhân vật
  Room.tsx           # Container chính: Header, Canvas 3D, ActionBar, Joystick, Queue
  Cinema3D.tsx       # Three.js Canvas: Sàn, bậc thang, đèn chiếu, local/remote characters
  Screen3D.tsx       # Màn chiếu 3D 16:9 với CSS3D YouTube iframe + nút Về LIVE
  Seats3D.tsx        # 60 ghế khán phòng đối xứng dùng InstancedMesh (1-2 draw calls)
  OxygenTanks3D.tsx  # 7 bình oxi dọc tường trái + biển neon 3D
  Character3D.tsx    # Chibi 3D (đầu to, thân đổi màu, animated walk/sit/crawl/breathe)
  CameraController.tsx # Camera 3rd person damping, zoom action, phím C màn chiếu
  VirtualJoystick.tsx # Cần điều khiển cảm ứng cho mobile
.env.example
package.json
tsconfig.json
README.md
```

---

## 4. Nguyên Tắc Hiệu Năng Bắt Buộc (60fps)
1. **Không setState trong vòng lặp render**: Toàn bộ chuyển động nhân vật, camera và animation nội suy xử lý bên trong `useFrame`, biến đổi trực tiếp thuộc tính Three.js vector / rotation.
2. **InstancedMesh cho 60 ghế**: Toàn bộ đệm và lưng ghế của 60 vị trí được gộp render qua `instancedMesh`, giảm số lượng draw call xuống mức tối thiểu.
3. **Bóng đổ & Ánh sáng tối ưu**: Chỉ dùng 1 `directionalLight` đổ bóng với shadow map `1024×1024`, kết hợp ánh sáng môi trường nhẹ và đèn hắt ấm áp.
4. **Adaptive DPR**: Sử dụng `<PerformanceMonitor>` để tự động điều chỉnh tỉ lệ pixel giữa `1.0` và `1.75` tùy theo cấu hình thiết bị.
5. **Nội suy chuyển động người khác (Damping)**: Vị trí người chơi từ xa được truyền qua Broadcast ở tần số 12–14Hz và được bên nhận làm mượt bằng damping (`MathUtils.damp`) để hiển thị 60fps không giật.
6. **Màn chiếu YouTube CSS3D**: Sử dụng `@react-three/drei` `<Html transform>` nhúng trực tiếp YouTube iframe không dùng filter/blur nặng, giữ main thread thông suốt.
