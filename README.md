# Esports Watch Party 3D · CKTG LMHT 🏆 (v2.3.1)

Ứng dụng web xem chung trận Chung Kết Thế Giới (CKTG) Liên Minh Huyền Thoại trong một **rạp chiếu phim 3D** sống động. Khán giả điều khiển nhân vật Chibi 3D phong cách hoạt hình (cel-shading) góc nhìn thứ 3 theo phong cách một chạm đơn giản (Sansa Temple), tự do đi lại trong khán phòng, click vào ghế để ngồi, trò chuyện, gáy bẩn, hò hét, ăn mừng SIUUU và tính năng **"Thở Oxi"** 3D khẩn cấp khi đội nhà lâm nguy!

---

## 🛠 Tech Stack (Bản 3D v2.3.1)

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript.
- **3D Graphics**: `three@0.174.0`, `@react-three/fiber@9.0.4`, `@react-three/drei@10.7.9` (đã ghim version cố định).
- **Styling & Shading**:
  - Pure CSS thuần (`app/globals.css`), **không dùng Tailwind**, không thư viện UI ngoài.
  - Cel / Toon Shading (`meshToonMaterial` + `<Outlines>`) cho nhân vật.
  - Sàn phẳng liền mạch $y = 0$, khán phòng thu gọn chuẩn mực (rộng 34m, sâu 36m, trần 22m).
  - 8 dãy ghế A–H × 14 ghế = 112 ghế (2 khối 7 ghế, lối giữa rộng 2.0m, cụm ghế chiếm ~70% chiều rộng sàn).
  - Màn chiếu khổng lồ 28×15.75m (16:9), mép dưới cách sàn ~4m, kèm 2 dải banner LED 28.6m chữ chạy cổ vũ.
  - Blob Shadows (plane tròn radial gradient) thay thế toàn bộ shadow maps nặng nề.
  - Sương mờ nhẹ `<fog>` (25..65) + `ACESFilmicToneMapping` cho độ sâu rạp chiếu phim điện ảnh.
- **State tần suất cao**: `zustand@5.0.3` + Shared Three.js Refs (`lib/playerRefs.ts`).
- **Realtime**: `@supabase/supabase-js` v2 (Broadcast + Presence, **không cần tạo bảng database**).
- **Fallback Local**: Tự động chuyển sang `BroadcastChannel` khi không có Supabase env để test nhiều tab cùng máy (`localhost:3002`).
- **Video & Trải Nghiệm Màn Chiếu (v2.3.1)**:
  - Khắc phục triệt để màn hình đen bằng cách bỏ `occlude="blending"` và chuẩn hóa `distanceFactor`.
  - Khởi tạo `YT.Player` duy nhất 1 lần, đổi video tức thì bằng `player.loadVideoById(id)` không destroy/recreate.
  - Nút "🔊 Bật tiếng" nổi trên màn chiếu khi player autoplay ở chế độ mute.
  - Trạng thái màn chiếu: Spinner loading và báo lỗi chuẩn mã kênh không cho nhúng (101/150).
- **Đổi Video Ngay Trong Rạp**: Nút "📺 Đổi video" trên header, popup nhập link/ID, tự nhận diện ID và preview thumbnail, đổi tức thì và broadcast cả phòng.
- **Âm thanh**: Web Audio API tự tổng hợp bằng thuật toán toán học (gà gáy, hò hét, SIUUU, pop chat, xả van oxi), không cần file MP3.
- **Deploy**: Vercel ready (`reactStrictMode: false`, port 3002).

---

## 🚀 1. Hướng Dẫn Chạy Local (Port 3002)

Yêu cầu Node.js (v18 trở lên):

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy server phát triển trên port 3002
npm run dev
```

Mở trình duyệt tại: **[http://localhost:3002](http://localhost:3002)**.

> **Mẹo test nhiều người:** Mở 2 đến 3 tab khác nhau tại `http://localhost:3002`. Hệ thống sẽ tự động bật **Demo local** thông qua `BroadcastChannel`. Mọi hành động chọn ghế, di chuyển 3D, chat bong bóng, gáy bẩn, thở oxi sẽ đồng bộ tức thì giữa các tab!

---

## ☁️ 2. Kết Nối Supabase Miễn Phí (Online Multi-device)

Để bạn bè trên khắp mọi nơi cùng vào xem chung phòng qua Internet:

1. Đăng ký tài khoản miễn phí tại [Supabase](https://supabase.com).
2. Bấm **New Project** và đặt tên cho dự án (ví dụ: `esports-watch-party-3d`).
3. Sau khi dự án khởi tạo xong, vào menu bên trái: **Project Settings** ➔ **API**.
4. Sao chép 2 giá trị:
   - **Project URL**
   - **Project API keys** (chọn khóa `anon` / `public`).
5. Tạo file `.env.local` ở thư mục gốc của dự án:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
NEXT_PUBLIC_YT_VIDEO_ID=jfKfPfyJRdk
ADMIN_KEY=admin123
```

*(Không cần chạy câu lệnh SQL hay tạo bảng vì ứng dụng sử dụng cơ chế Realtime Presence & Broadcast)*.

Khởi động lại server, góc trên màn hình sẽ hiện huy hiệu xanh lá `● Online`.

---

## 📺 3. Đổi Video Nhanh & Trang Quản Trị Admin

### A. Đổi Video Trực Tiếp Trên Header Rạp:
- Bấm nút **"📺 Đổi video"** ở góc trên bên phải màn hình.
- Dán link YouTube bất kỳ hoặc Video ID: modal tự động trích xuất ID và hiện hình thu nhỏ (thumbnail preview).
- Bấm **"💾 Lưu & chiếu ngay"**: Màn chiếu đổi tức thì cho toàn bộ khán phòng thông qua realtime broadcast và lưu trạng thái vào localStorage.

### B. Quản Trị Toàn Diện (`/admin?key=<ADMIN_KEY>`):
- Đăng nhập vào trang Admin: **[http://localhost:3002/admin?key=admin123](http://localhost:3002/admin?key=admin123)**.
- Khóa bảo mật: `ADMIN_KEY=admin123` (cấu hình trong file `.env.local`).
- **Đổi nguồn video**: Dán link YouTube hoặc video ID bất kỳ, bấm **"Đổi video phòng ngay"**. Màn chiếu của tất cả người xem trong phòng sẽ tự động chuyển sang video mới tức thì mà không cần F5 trình duyệt.
- **Chỉnh sửa 2 dải banner cổ vũ 30.2m**:
  - Dải trên (mép trên màn chiếu · Vàng óng): mặc định cổ vũ các đội tuyển ("T1 FIGHTING! ★ GEN.G VÔ ĐỊCH! ★...").
  - Dải dưới (mép dưới màn chiếu · Xanh neon): mặc định hô hào ("HÒ HÉT ĐI NÀO! • SIUUUUU! • THỞ OXI CẤP CỨU! •...").
  - Bấm **"Cập nhật 2 dải banner cổ vũ ngay"** để broadcast tới tất cả người xem trong phòng qua Realtime.

---

## 🎮 4. Điều Khiển, Phím Tắt & Tính Năng Mới (v2.3)

### Màn Hình Chờ / Lobby 3D Tương Tác:
- Khi vừa vào trang, bạn ở chế độ **Khán Giả 3D**: rạp 3D thật xoay chậm từ góc cao isometric, hiển thị mọi hoạt động của các khán giả đang có trong phòng.
- Chọn nickname, màu áo (8 nút tròn 32px viền vàng, xem trước chibi) và cách thao tác ngay trên thẻ trung tâm.
- Bấm **"Vào rạp thưởng thức trận đấu 🎬"**: Camera thực hiện cú lướt mượt mà 1.2s từ trên cao xuống khán phòng.

### Điều Khiển & Phím Tắt:
| Chế độ | Di chuyển | Xoay camera | Zoom góc nhìn |
| :--- | :--- | :--- | :--- |
| **⌨️ Bàn phím (Mặc định)** | **WASD / Mũi tên** | **Giữ chuột TRÁI + Kéo** | **Cuộn chuột (Wheel)** |
| **🖱️ Chuột (Point & Click)** | **Click sàn / ghế** | **Giữ chuột PHẢI + Kéo** | **Cuộn chuột (Wheel)** |

### Các Phím Tắt Tiện Ích:
| Phím | Chức năng | Chi tiết |
| :--- | :--- | :--- |
| **`Cuộn chuột`** | **Zoom mượt mà (3 → 35)** | Khoảng cách từ 3.0 đến 35.0 (mặc định 12.0). Khi zoom xa góc pitch tự dốc lên để bao quát toàn bộ rạp và màn chiếu 28m. Khi camera chạm tường sau thì trượt lên cao (pitch tối đa 65°). |
| **`E`** | **Ngồi / Đứng dậy** | Ngồi vào ghế gần nhất hoặc đứng dậy ra lối đi trước dãy ghế (đang ngồi bấm WASD cũng tự đứng dậy). |
| **`C`** | **Xem Màn Chiếu** | Lia thẳng camera vào màn chiếu YouTube toàn cảnh. |
| **`1`** | **😮💨 Thở Oxi** | Bò ra trạm bình oxi để nạp khí khẩn cấp trong 6 giây rồi quay về ghế (camera bám theo tự nhiên, khóa góc nhìn với khoảng cách $\ge 11$). |
| **`2`** | **🐓 Gáy bẩn** | Camera khóa góc nhìn thứ 3 phía sau (cao 6m, pitch 30°, khoảng cách $\ge 11$), thấy trọn toàn thân + hiệu ứng + ghế + màn chiếu. |
| **`3`** | **📣 Hò hét** | Rung lắc cơ thể, la hét cổ vũ đội tuyển, camera khóa góc nhìn thứ 3 điện ảnh. |
| **`4`** | **🙌 SIUUU** | Bật nhảy 360 độ, bắn tung 18 mảnh pháo hoa giấy rực rỡ, camera khóa góc nhìn thứ 3 điện ảnh. |
| **`Enter`** | **💬 Trò chuyện** | Hiện bong bóng chat 3D sống động trên đầu nhân vật (Troika GPU text). |

---

## ⚡ 5. Các Tối Ưu Triệt Tiêu Giật & Đạt 60fps Bền Vững (v2.3)

1. **Khán phòng 2x & Màn chiếu 28m**: Không gian rạp rộng rãi, 6 dãy ghế A–F cách nhau 3.2m, sảnh sau rộng thênh thang, màn chiếu 28×15.75m bao trọn tầm nhìn.
2. **Sàn phẳng $y = 0$ & Loại bỏ Bậc thang**: Mọi dãy ghế và nhân vật di chuyển trên cùng một mặt phẳng trơn tru, không tính toán độ cao gián đoạn, loại bỏ hoàn toàn hiện tượng nảy giật khi đi lại.
3. **Hai dải Banner LED Chạy Hiệu Năng Cao**: Chữ tiếng Việt có dấu được vẽ đúng 1 lần lên `CanvasTexture` 4096×128 (font Be Vietnam Pro), trong `useFrame` chỉ tăng `texture.offset.x` trên GPU, không re-render React, không dùng `<Html>`.
4. **Triệt tiêu Garbage Collection (Zero Object Allocation in `useFrame`)**: Mọi vector, quaternion, matrix dùng để tính toán camera, hướng di chuyển, hạt pháo giấy được tái sử dụng qua các biến tĩnh ở module scope.
5. **Hệ đèn 4 nguồn sáng cố định**: 1 `hemisphereLight` (1.8) + 1 `ambientLight` (0.35) + 1 `directionalLight` (1.0) + 1 screen glow light, rạp sáng rực rỡ ở cả mức zoom xa 35. Chế độ TẮT đèn giữ ~40% độ sáng.
6. **Loại bỏ DOM `<Html>` quá tải**: Chuyển toàn bộ tên nhân vật, bong bóng chat, action pill, nhãn bình oxi và tooltip sang `<Billboard>` + Troika `<Text>` 3D chạy trực tiếp trong WebGL trên GPU. Duy nhất 1 `<Html>` được giữ lại cho iframe YouTube với `zIndexRange={[10, 0]}` được bảo toàn.
7. **Adaptive DPR**: Desktop [1.25, 2.0], Mobile [1.0, 1.5], tự động điều chỉnh từng nấc 0.25 để không bị giật khung hình đột ngột.
