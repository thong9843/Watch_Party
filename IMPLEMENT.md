# IMPLEMENT.md — Esports Watch Party 3D (Spec v2.1)

> **Nguồn sự thật (Single Source of Truth) cho bản 3D v2.1.**
> Cập nhật toàn bộ kiến trúc từ 2D lên 3D không gian rạp chiếu phim, nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách tương tác một chạm Sansa Temple, Lobby 3D tương tác thực, Fix giật GC, Nâng cấp Cel-shading & Ánh sáng rạp chiếu.

---

## 0. Tiến độ Nâng cấp Bản 3D v2 & v2.1
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
  - Đứng dậy đặt ở `seat.z + 1.2`, dùng `resolveOutOfAABB()`. Đang ngồi bấm WASD tự đứng dậy.
  - Camera-relative WASD theo góc nhìn camera.
  - Camera pitch 10°–55°, phím `Z` toggle Gần/Xa.
  - Quản trị video `/admin?key=<ADMIN_KEY>` với Server Action và broadcast realtime.
- [x] **P10 (v2.1) Fix Giật GC, Toon/Cel-shading, Rạp rộng 30%, Hệ đèn cố định & Lobby 3D**:
  - **Triệt tiêu Garbage Collection spikes**:
    - Xóa toàn bộ `new THREE.Vector3/Matrix4/Color` trong `useFrame` (dùng static module-scope vectors: `_focusCenter`, `_desiredCamPos`, etc.).
    - Loại bỏ hoàn toàn dynamic light mount/unmount lúc runtime (bình oxi phát sáng bằng `emissiveIntensity` 0.9, không dùng pointLight).
    - Giảm `<Html>` xuống mức tối thiểu: tên nhân vật, chat bubble, action pills, nhãn bình oxi và tooltip ghế chuyển sang Troika `<Text>` + `<Billboard>` render trực tiếp trên GPU. Chỉ giữ `<Html>` duy nhất cho iframe YouTube.
    - Raycast kiểm tra tường chống xuyên camera chạy throttled tối đa 20 lần/giây (khoảng cách >= 50ms).
    - `PerformanceMonitor` thích ứng: Desktop `[1.25, 2.0]`, Mobile `[1.0, 1.5]`, hạ/nâng bậc từ từ step 0.25.
  - **Nâng cấp Hình ảnh Toon / Cel-shading**:
    - Sử dụng `MeshToonMaterial` cho nhân vật, ghế, bình oxi.
    - Thêm `<Outlines thickness={0.025}>` tạo viền cartoon sắc nét cho nhân vật.
    - Bỏ realtime shadow maps nặng nề; thay bằng Blob Shadows (plane tròn radial gradient mỏng trên sàn dưới chân mỗi nhân vật).
    - Thêm `toneMapping = ACESFilmic`, `outputColorSpace = SRGB`, sương mờ nhẹ `<fog args={['#07070a', 15, 42]}>`.
  - **Không gian rạp rộng hơn 30% & Hệ đèn rạp 2 chế độ**:
    - Biên X từ $\pm 8.6 \rightarrow \pm 11.8$. Khoảng cách ghế $1.25$, khoảng cách dãy $2.8$. Lối đi giữa rộng $1.8 \ge 1.6$, lối đi 2 bên rộng $> 2.8$.
    - Hệ đèn cố định tối đa 3 nguồn sáng: 1 `hemisphereLight` + 1 `directionalLight` (không bóng đổ nặng) + 1 screen glow light.
    - Dải đèn LED dọc bậc thang ghế và đèn hắt tường bằng mesh emissive (zero light cost).
    - Nút **💡 Đèn rạp** trên header với 2 chế độ (BẬT sáng ấm / TẮT rạp phim tối dịu) lerp mượt mà trong 0.6s.
  - **Màn hình chờ / Lobby 3D tương tác**:
    - Gộp JoinScreen + chọn cách thao tác vào 1 trải nghiệm Lobby 3D: rạp 3D thật xoay isometric chậm phía sau, hiển thị người đang xem thật.
    - Chế độ CHỈ XEM: nghe Presence & Broadcast nhưng KHÔNG `track()`, không chiếm chỗ.
    - Card trung tâm: hiển thị live count, input nickname, chọn màu áo (kèm preview Chibi SVG), chọn Bàn phím / Chuột.
    - Bấm "Vào rạp": camera bay mượt mà 1.2s từ góc cao xuống cửa vào, sau đó mới chính thức `track()`.

---

## 1. Mục tiêu & Phạm vi v2.1
- Web xem chung trận LMHT CKTG (nguồn YouTube Live) trong **rạp chiếu phim 3D**.
- Nhân vật Chibi 3D góc nhìn thứ 3 phong cách cel-shading hoạt hình, đi lại tự do trong khán phòng, click-to-move chạm vào ghế để tự đi tới ngồi.
- Giữ nguyên toàn bộ cơ chế realtime: Supabase Realtime (Broadcast + Presence) + fallback `BroadcastChannel` local mode cho nhiều tab.
- Port mặc định: **3002** (`http://localhost:3002`).

---

## 2. Tech Stack (3D v2.1)
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
