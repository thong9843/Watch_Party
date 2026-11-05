# IMPLEMENT.md — Esports Watch Party 3D (Spec v2.2)

> **Nguồn sự thật (Single Source of Truth) cho bản 3D v2.2.**
> Cập nhật toàn bộ kiến trúc từ 2D lên 3D không gian rạp chiếu phim, nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách tương tác một chạm Sansa Temple, Lobby 3D tương tác thực, Fix giật GC, Nâng cấp Cel-shading & Ánh sáng rạp chiếu, Zoom cuộn chuột, Camera Action 3/4 không khóa, Sàn phẳng $y = 0$, Nâng màn chiếu và 2 dải Banner LED cổ vũ chạy chữ.

---

## 0. Tiến độ Nâng cấp Bản 3D v2, v2.1 & v2.2
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
- [x] **P11 (v2.2) Zoom Con Lăn Chuột, Camera Action 3/4, Sàn Phẳng, Nâng Màn Chiếu & 2 Dải Banner Cổ Vũ**:
  - **Zoom Con Lăn Chuột (Wheel Zoom 3 → 18)**:
    - Bỏ phím `Z`, dùng chuột cuộn mượt mà nhân/chia 1.12 mỗi nấc, khoảng cách từ 3.0 đến 18.0 (mặc định 7.5).
    - Lắng nghe `wheel` với `{ passive: false }` + `preventDefault()` trên Canvas, không làm cuộn trang web.
    - Zoom càng xa góc pitch tự dốc lên từ 20° đến 40° để bao quát toàn bộ rạp và các hàng ghế.
  - **Camera Action 3/4 Phía Trước Nhân Vật (Không Khóa Góc Nhìn)**:
    - Khi làm action (Gáy bẩn, Hò hét, SIUUU): camera chuyển mượt sang góc 3/4 phía trước nhân vật, khoảng cách = `max(zoom, 6)`, cao 2.8.
    - Thấy rõ toàn thân, hiệu ứng chữ, pháo hoa giấy và các ghế xung quanh.
    - KHÔNG khóa góc nhìn: người dùng kéo chuột hoặc lăn zoom trong lúc action sẽ hủy auto-camera ngay lập tức.
    - Hết action (2.5s) camera tự trở về góc cũ và giữ nguyên mức zoom người dùng đã chọn.
    - Thở oxi: camera chỉ bám theo nhân vật ở khoảng cách hiện tại, không zoom vào.
  - **Sàn Phẳng $y = 0$ & Bỏ Bậc Thang**:
    - Xóa `getContinuousHeight`, toàn bộ 6 dãy ghế A–F nằm trên mặt phẳng $y = 0$, đệm ghế $y = 0.45$.
    - Không nảy giật khi di chuyển; đường đi waypoint, trạm oxi và ghế đều chạy trên sàn phẳng.
    - Nâng màn chiếu lên: tâm tại $Y = 8.7$, mép dưới cách sàn ~3.5m giúp hàng trước không che màn với hàng sau.
  - **Ánh Sáng & Màu Sắc Rực Rỡ**:
    - Đèn BẬT: `hemisphereLight` 1.8 (sky `#fff4e0`, ground `#3a332d`), `ambientLight` 0.35, `directionalLight` 1.0 từ phía trên-sau, `pointLight` màn chiếu. Tổng 4 light thật cố định.
    - Đèn TẮT: giữ ~40% độ sáng, vẫn nhìn rõ nhân vật.
    - Màu vật liệu: tường `#3a332d`, sàn `#3b342e`, ghế đỏ nhung `#9b2335`.
  - **Hai Dải Banner LED Chữ Chạy Cổ Vũ (Mép Trên & Dưới Màn Chiếu)**:
    - 2 dải LED dài bằng chiều rộng màn chiếu (+10%), cao 0.6m.
    - Render hiệu năng cao: vẽ 1 lần lên `CanvasTexture` 4096×128 (font `Be Vietnam Pro` đậm 98px ~80% chiều cao canvas, glow kép sắc nét), trong `useFrame` chỉ tăng/giảm `texture.offset.x` trên GPU, 2 dải chạy ngược chiều nhau. Banner TRÊN hạ xuống sát mép trên màn chiếu (Y = 13.6, Z = -13.95), nằm trọn vẹn trong khung hình camera mặc định.
    - Trang Admin (`/admin?key=<ADMIN_KEY>`) có form sửa nội dung 2 dải banner realtime.
  - **Nhãn Ghế [E] Trong Seats3D**: Bỏ hoàn toàn khối nền cam, hiển thị trực tiếp bằng `AppText` vàng `#fbbf24` viền đen `#000000` đồng bộ phong cách tên nhân vật.
  - **Loại Trừ Cuộn Chuột / Click**: `CameraController` bổ sung `.lobby-3d-card`, `.lobby-3d-overlay`, `.admin-page-wrap` vào danh sách loại trừ zoom/drag chuột.

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
