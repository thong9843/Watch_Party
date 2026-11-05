# IMPLEMENT.md — Esports Watch Party 3D (Spec v2.3)

> **Nguồn sự thật (Single Source of Truth) cho bản 3D v2.3.**
> Cập nhật toàn bộ kiến trúc từ 2D lên 3D không gian rạp chiếu phim, nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách tương tác một chạm Sansa Temple, Lobby 3D tương tác thực, Fix giật GC, Nâng cấp Cel-shading & Ánh sáng rạp chiếu, Zoom cuộn chuột 3 → 35, Camera Action Khóa Góc Nhìn Thứ 3 Phía Sau, Sàn phẳng $y = 0$, Rạp mở rộng gấp 2 lần, Màn chiếu khủng 28m, Ghế quay chuẩn hướng màn chiếu và Bộ đổi video YouTube trực tiếp trong rạp.

---

## 0. Tiến độ Nâng cấp Bản 3D v2, v2.1, v2.2 & v2.3
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
- [x] **P9 Fix Điều khiển, Camera, Chế độ thao tác & Nguồn Video tập trung**:
  - Đứng dậy đặt ở `seat.z + 1.2`, dùng `resolveOutOfAABB()`. Đang ngồi bấm WASD tự đứng dậy.
  - Camera-relative WASD theo góc nhìn camera.
  - Quản trị video `/admin?key=<ADMIN_KEY>` với Server Action và broadcast realtime.
- [x] **P10 (v2.1) Fix Giật GC, Toon/Cel-shading, Rạp rộng 30%, Hệ đèn cố định & Lobby 3D**:
  - Triệt tiêu Garbage Collection spikes (static vectors module scope).
  - Loại bỏ hoàn toàn dynamic light mount/unmount lúc runtime.
  - Giảm `<Html>` xuống mức tối thiểu (Troika `<Text>` + `<Billboard>` GPU).
  - Raycast kiểm tra tường chống xuyên camera chạy throttled tối đa 20 lần/giây (khoảng cách >= 50ms).
  - Nâng cấp hình ảnh Toon / Cel-shading (`meshToonMaterial` + `<Outlines>`).
- [x] **P11 (v2.2) Zoom Con Lăn Chuột, Sàn Phẳng, Nâng Màn Chiếu & 2 Dải Banner Cổ Vũ**:
  - Zoom mượt mà bằng con lăn chuột, sàn phẳng $y = 0$, 2 dải banner cổ vũ 4096×128 LED chạy chữ offset GPU.
- [x] **P12 (v2.3) Sửa Ghế Ngược, Khóa Camera Action Thứ 3 Phía Sau, Rạp 2x, Zoom 35 & Đổi Video Ngay Trong Rạp**:
  - **1. Ghế Quay Đúng Hướng Màn Chiếu**: Lưng ghế hướng ra CUỐI rạp ($+Z$), đệm ghế và mặt người ngồi hướng về MÀN CHIẾU ($-Z$). Thêm tay vịn 2 bên đệm ghế. Nhân vật ngồi trước lưng ghế, mặt quay về màn chiếu. Đứng dậy ra trước dãy ghế ($s.z - 1.1$). AABB va chạm cập nhật chính xác.
  - **2. Camera Action Khóa Góc Nhìn Thứ 3 Phía Sau**:
    - Khi làm action (Gáy bẩn, Hò hét, SIUUU, Thở oxi): KHÓA camera suốt thời gian action, bỏ qua mọi thao tác kéo chuột và lăn chuột.
    - Vị trí camera: Góc nhìn thứ 3 PHÍA SAU, chếch lên trên nhân vật: khoảng cách = `max(zoom, 11)`, cao $\sim 6.0$, pitch $\sim 30^\circ$, nhìn vào điểm cao 1.2 trên nhân vật.
    - Khung hình bao quát: thấy toàn thân nhân vật + hiệu ứng + $\ge 2$ hàng ghế + một phần màn chiếu 28m.
    - Chuyển vào/ra mượt mà bằng lerp/damp $\sim 0.5$s.
    - Thở oxi: bám theo nhân vật suốt quá trình bò đi và về với khoảng cách $\ge 11.0$.
  - **3. Khán Phòng Mở Rộng Gấp 2 Lần & Zoom Xa Đến 35**:
    - Kích thước rạp: rộng 48m ($X = \pm 24$), sâu 56m ($Z = -22 \to +30$), trần 22m.
    - Màn chiếu khổng lồ: $28 \times 15.75$m (16:9), mép dưới cách sàn $\sim 4$m (tâm $Y = 11.875, Z = -20$).
    - 6 dãy $\times$ 10 ghế: ghế cách ghế 1.4m, dãy cách dãy 3.2m. Hàng A cách màn chiếu 10m ($Z = -10.0$). Sảnh sau dãy F sâu $\sim 23$m. Lối đi 2 bên $> 4$m.
    - 7 trạm oxi dọc tường trái ($X = -20.0$), tốc độ bò tăng 1.5 lần (`0.0075`).
    - Gom hằng số cấu hình vào `lib/layout.ts`.
    - Hệ thống đèn: cố định 4 light thật tăng cường độ, dải LED chân tường và lối đi, camera far 200, fog 35..90.
    - Zoom con lăn mở rộng: $3.0 \to 35.0$ (mặc định 12.0). Chống xuyên tường sau: khi camera chạm tường sau thì trượt lên cao (pitch tăng tối đa $\sim 65^\circ$).
  - **4. Nút Đổi Video Trực Tiếp Ngay Trong Rạp**:
    - Nút "📺 Đổi video" trên header cạnh nút "Đèn rạp".
    - Popup modal: ô nhập link/ID YouTube, tự động nhận diện và preview thumbnail `mqdefault.jpg`, hiển thị badge ID đã nhận diện.
    - Nút "💾 Lưu & chiếu ngay" (validate `extractYouTubeId`).
    - Đổi video tức thì không cần reload trang, lưu vào `localStorage`, broadcast `admin_video` đồng bộ cả phòng, hiện toast "🎬 [tên] đã đổi video".
    - Người vào sau tự động nhận video hiện tại qua Presence metadata hoặc localStorage.
    - Thứ tự ưu tiên: `?v=` > presence/admin video > localStorage > env default.

---

## 1. Mục tiêu & Phạm vi v2.2
- Web xem chung trận LMHT CKTG (nguồn YouTube Live) trong **rạp chiếu phim 3D**.
- Nhân vật Chibi 3D góc nhìn thứ 3 phong cách cel-shading hoạt hình, đi lại tự do trong khán phòng, click-to-move chạm vào ghế để tự đi tới ngồi.
- Giữ nguyên toàn bộ cơ chế realtime: Supabase Realtime (Broadcast + Presence) + fallback `BroadcastChannel` local mode cho nhiều tab.
- Port mặc định: **3002** (`http://localhost:3002`).

---

## 2. Tech Stack (3D v2.2)
| Thành phần | Công nghệ | Phiên bản (Ghim cố định) |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript | `next@15.2.1`, `react@19.0.0` |
| 3D Engine | Three.js + React Three Fiber + Drei | `three@0.174.0`, `@react-three/fiber@9.0.4`, `@react-three/drei@10.7.9` |
| High-freq State | Zustand + Shared Three Refs (`playerRefs.ts`) | `zustand@5.0.3` |
| Shading Style | Cel/Toon Shading (`meshToonMaterial`) + `<Outlines>` + Blob Shadows | R3F / Drei |
| Styling | CSS thuần `app/globals.css` (không Tailwind, không thư viện UI ngoài) | CSS3 thuần |
| Realtime | `@supabase/supabase-js` (Presence + Broadcast, không cần tạo bảng) | `@supabase/supabase-js@2.49.1` |
| Fallback | `BroadcastChannel` cho tab cùng trình duyệt khi thiếu env Supabase | Chuẩn Web API |
| Âm thanh | Web Audio API tự tổng hợp (sawtooth glide, bandpass noise, triangle, hiss) | Web Audio API |
| Deploy | Vercel ready (`reactStrictMode: false`) | Port 3002 |
