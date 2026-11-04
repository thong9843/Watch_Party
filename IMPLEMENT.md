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
- [x] **P9 Fix Điều khiển, Camera, Chế độ thao tác & Nguồn Video tập trung**:
  - **Sửa lỗi WASD**:
    - Khi đứng dậy: đưa nhân vật ra lối đi ngang trước dãy ghế (`seat.z + 1.2`), dùng `resolveOutOfAABB()` đẩy ra ngoài nếu kẹt.
    - Đang ngồi mà nhấn WASD / phím mũi tên → tự động đứng dậy.
    - Hướng di chuyển tương đối theo Camera: W đi tới theo góc camera, A/D sang ngang, nhân vật xoay mượt mà theo hướng đi.
    - Key listeners gộp vào 1 effect đăng ký 1 lần, xóa `keysPressed` khi blur, visibilitychange, focus input chat, ngồi xuống/đứng dậy. Bỏ qua `e.repeat` cho E và 1–4, debounce sit/stand 400ms.
  - **Camera v2**:
    - Khoảng cách mặc định ~6.5, cao ~3.2, pitch 10°–55° có damping. Bỏ scroll zoom chuột, phím `Z` chuyển đổi 2 mức cố định Gần (~4.2) / Xa (~6.5).
    - Phân biệt click và drag (> 5px). Giữ chuột trái kéo (mode bàn phím) hoặc giữ chuột phải kéo (mode chuột) không bị nhầm với click sàn/ghế.
    - Chống camera xuyên tường rạp chiếu.
  - **Modal Chọn chế độ thao tác**:
    - Modal xuất hiện khi vào phòng trên desktop (lưu vào localStorage, nút ⚙️ trên header để đổi lại).
    - Mode Bàn phím: tắt click-to-move trên sàn, click ghế vẫn đi tới ngồi.
    - Thanh gợi ý phím cố định ở góc dưới màn hình.
  - **Nguồn Video tập trung & Trang Admin**:
    - Luồng ưu tiên: query `?v=` > video admin phát tán > env `NEXT_PUBLIC_YT_VIDEO_ID`.
    - Trang quản trị `/admin?key=<ADMIN_KEY>` (key bí mật `ADMIN_KEY=admin123` cấu hình trong `.env.local`).
    - Admin đổi link/ID YouTube → phát tán event `admin_video` qua Realtime → tất cả khán giả tự động load video mới không cần F5.

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
  layout.tsx             # Root layout, metadata & viewport
  page.tsx               # Entry page: JoinScreen -> 3D Room, parse ?v= và ?room=
  globals.css            # Toàn bộ CSS thuần cho rạp 3D, UI overlays, action bar, joystick, modal, admin
  admin/
    page.tsx             # Trang quản trị nguồn video rạp chiếu (/admin?key=<ADMIN_KEY>)
    actions.ts           # Server Action xác thực ADMIN_KEY bảo mật
lib/
  types.ts               # Data model: Member, ActionType, RoomEvent, PlayerPosUpdate, ControlMode
  layout.ts              # Tọa độ 3D: seatPos3D, tankPos3D, AABB ghế, resolveOutOfAABB, getPathToSeat
  playerRefs.ts          # Shared Three.js refs, cameraYawRef & RemotePlayers Map
  realtime.ts            # Lớp kết nối realtime (Supabase / BroadcastChannel multi-room)
  store.ts               # Zustand store cho discrete states, controlMode, adminVideoId, cameraDistancePreset
  sfx.ts                 # Web Audio API tổng hợp âm thanh (gà gáy, hò hét, SIUU, pop, oxi)
components/
  JoinScreen.tsx         # Màn hình chọn nickname & màu áo nhân vật
  ControlModeModal.tsx   # Modal chọn chế độ thao tác (Bàn phím vs Chuột)
  Room.tsx               # Container chính: Header, Canvas 3D, ActionBar, Joystick, Queue, Pill hint
  Cinema3D.tsx           # Three.js Canvas: Sàn, bậc thang, đèn chiếu, camera-relative movement
  Screen3D.tsx           # Màn chiếu 3D 16:9 với CSS3D YouTube iframe + nút Về LIVE
  Seats3D.tsx            # 60 ghế khán phòng đối xứng dùng InstancedMesh (1-2 draw calls)
  OxygenTanks3D.tsx      # 7 bình oxi dọc tường trái + biển neon 3D
  Character3D.tsx        # Chibi 3D (LocalCharacter3D & RemoteCharacter3D đọc ref trong useFrame)
  CameraController.tsx   # Camera 3rd person damping, fixed near/far (Z), chống xuyên tường, drag orbit
  VirtualJoystick.tsx    # Cần điều khiển cảm ứng cho mobile
.env.example
package.json
tsconfig.json
README.md
```
