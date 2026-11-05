# IMPLEMENT.md — Esports Watch Party 3D (Spec v2.3.1)

> **Nguồn sự thật (Single Source of Truth) cho bản 3D v2.3.1.**
> Cập nhật toàn bộ kiến trúc từ 2D lên 3D không gian rạp chiếu phim, nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách tương tác một chạm Sansa Temple, Lobby 3D tương tác thực, Fix giật GC, Nâng cấp Cel-shading & Ánh sáng rạp chiếu, Khắc phục triệt để màn hình đen video YouTube, Thu gọn không gian rạp vừa vặn (34m × 36m), Cụm ghế chiếm ~70% sàn (8 dãy × 14 ghế = 112 ghế), Camera mặc định bao quát màn chiếu ở 10–45% khung hình, Nút Bật tiếng nổi và Chống tạo lại YT.Player.

---

## 0. Tiến độ Nâng cấp Bản 3D v2, v2.1, v2.2, v2.3 & v2.3.1
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
  - Sửa hướng ghế quay về màn chiếu, camera action khóa góc nhìn thứ 3 điện ảnh từ phía sau, rạp mở rộng 2x, nút đổi video nhanh.
- [x] **P13 (v2.3.1) Sửa Video Đen + Thu Gọn Rạp 34m × 36m & 112 Ghế**:
  - **1. Khắc Phục Triệt Để Video Đen**:
    - Screen3D `<Html>`: Xóa `occlude="blending"` (blending đặt iframe dưới canvas dẫn tới bị che khuất đen), giữ `zIndexRange={[10, 0]}`.
    - Sửa kích thước khớp màn chiếu: `distanceFactor={(SCREEN_W * 400) / 1280}`.
    - Chống tạo lại player liên tục: Chỉ tạo `YT.Player` đúng 1 lần trên mount. Khi đổi video, gọi `player.loadVideoById(id)`, không destroy/recreate player.
    - Quản lý videoId bằng 1 hàm duy nhất `resolveVideoId` theo thứ tự ưu tiên: `?v=` → room video → localStorage → env. Log console khi videoId thay đổi.
    - Overlay trạng thái màn chiếu: Spinner "Đang tải video…" khi loading; bắt mã lỗi `onError` (101/150: "Kênh này không cho nhúng video", 2/100: "Link không hợp lệ").
    - Nút "🔊 Bật tiếng" (`video-unmute-btn`) nổi trên màn chiếu khi player đang mute (autoplay bắt buộc mute để phát hình).
  - **2. Thu Gọn Rạp Cho Đỡ Trống & 112 Ghế**:
    - Biên X thu về $\pm 17$ (sàn rộng 34m). Tường sau cách dãy cuối ~6.4m ($ROOM\_BACK\_Z = 16.0$). Cửa vào và điểm spawn ngay sau dãy cuối ($Z = 12.8$).
    - 8 dãy × 14 ghế = 112 ghế (2 khối 7 ghế, lối giữa rộng 2.0m). Cụm ghế chiếm đúng ~70% chiều rộng sàn (~23.8m / 34m).
    - 8 bình oxi xếp dọc tường trái $X = -17.0$, lối đi trái rộng $5.1$m.
    - Camera mặc định: Thấy màn chiếu ở 10–45% chiều cao khung hình ($dist = 7.5, pitch = 18^\circ$).
    - Dòng gợi ý di chuyển (`control-hint-pill`) nằm ngay trên thanh Action Bar, tự ẩn sau 6s.
    - Giới hạn hàng chờ cập nhật theo tổng số ghế: 112 ghế.
- [x] **P14 (v3.0.0) Tối Ưu Dài Hạn (O1, O2, O3)**:
  - **Giai đoạn O1 — Đồ họa & Instancing 60+ nhân vật mượt 60fps**:
    - Gộp mesh nhân vật bằng `mergeGeometries`: mỗi nhân vật tối đa 2 mesh (thân áo + đầu/tóc/chi với Vertex Colors). Dùng chung 1 geometry và 1 material cho mọi nhân vật.
    - InstancedMesh cho toàn bộ remote player ở trạng thái bình thường (ngồi/đi). Chỉ người làm action/thở oxi mới tách riêng.
    - Hệ thống LOD & giới hạn tối đa 20 nhãn tên hiển thị cùng lúc (gần nhất + bản thân).
    - 1 InstancedMesh pool 300 hạt Confetti chung, tối đa 8 hiệu ứng đồng thời.
    - Âm thanh action không gian: ở khoảng cách > 20m tự động giảm volume, tối đa 4 âm thanh action cùng lúc.
    - Tùy chọn chất lượng đồ họa: Thấp / Vừa / Cao / Tự động (lưu localStorage).
    - Giả lập 60 bot (`?bots=60`): đo benchmark đạt ~60 FPS, draw calls chỉ 122 calls, JS memory 21.9 MB.
  - **Giai đoạn O2 — Tối ưu mạng Supabase**:
    - Gói tin vị trí siêu gọn dạng mảng: `[id, x, z, rotY, pose]` giảm gần 70% kích thước.
    - Tần suất $\le 5$ gói/s khi di chuyển, đứng yên/ngồi ghế = 0 gói/s.
    - Anti-spam: chat 1 tin/s (tối đa 60 ký tự), action cooldown 4s. Phía nhận tự động lọc sender spam.
    - Chia phòng tự động (Auto room partition): tối đa 60 người/phòng, tự động chuyển phòng khi đầy, xem chung 1 luồng video.
  - **Giai đoạn O3 — Database, bảo mật & hoàn thiện**:
    - `supabase/schema.sql` với RLS: `room_config`, `chat_log` (auto-delete sau 7 ngày), `reports`.
    - Server-only API Next.js `POST /api/admin/config` dùng `SUPABASE_SERVICE_ROLE_KEY` và rate limit 5 lần/phút/IP. Xóa client broadcast trực tiếp `admin_video`.
    - Tính năng báo cáo `POST /api/report`, ẩn người chơi (client mute), bộ lọc từ ngữ thô tục `lib/badwords.ts`.
    - WebGL Error Boundary bắt lỗi crash đồ họa và hiển thị nút tải lại trang.
    - GitHub Actions CI workflow (`.github/workflows/ci.yml`).

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
