# Esports Watch Party 3D · CKTG LMHT 🏆

Ứng dụng web xem chung trận Chung Kết Thế Giới (CKTG) Liên Minh Huyền Thoại trong một **rạp chiếu phim 3D** sống động. Người tham gia điều khiển nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách một chạm đơn giản (Sansa Temple), tự do đi lại trong khán phòng, click vào ghế để ngồi, trò chuyện, gáy bẩn, hò hét, ăn mừng SIUUU và đặc biệt là tính năng **"Thở Oxi"** 3D khẩn cấp khi đội nhà lâm nguy!

---

## 🛠 Tech Stack (Bản 3D v2)

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript.
- **3D Graphics**: `three@^0.174.0`, `@react-three/fiber@^9.0.4`, `@react-three/drei@^10.7.9`.
- **State tần suất cao**: `zustand@^5.0.3` (quản lý input, camera và vị trí realtime không gây re-render cây DOM).
- **Styling**: Pure CSS thuần (`app/globals.css`), **không dùng Tailwind**, không thư viện UI ngoài.
- **Realtime**: `@supabase/supabase-js` v2 (Broadcast + Presence, **không cần tạo bảng database**).
- **Fallback Local**: Tự động chuyển sang `BroadcastChannel` khi không có Supabase env để test nhiều tab cùng máy (`localhost:3002`).
- **Video**: YouTube IFrame Player API (nhúng mặt phẳng 3D bằng `<Html transform>`, không restream, không vi phạm bản quyền).
- **Âm thanh**: Web Audio API tự tổng hợp bằng thuật toán toán học (gà gáy, hò hét, SIUUU, pop chat, xả van oxi), không cần file MP3.
- **Model nhân vật**: Dựng bằng Three.js low-poly primitives (chibi đầu to, thân đổi màu theo người dùng chọn), chạy mượt mà 60fps trên mọi thiết bị mà không phụ thuộc file 3D nặng ngoài mạng.
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
```

*(Không cần chạy câu lệnh SQL hay tạo bảng vì ứng dụng sử dụng cơ chế Realtime Presence & Broadcast)*.

Khởi động lại server, góc trên màn hình sẽ hiện huy hiệu xanh lá `● ONLINE`.

---

## 🌐 3. Triển Khai Lên Vercel (Deploy)

1. Đẩy mã nguồn lên kho lưu trữ GitHub của bạn:
   ```bash
   git init
   git add .
   git commit -m "feat: esports watch party 3d v2"
   git branch -M main
   git remote add origin <URL_REPO_GITHUB>
   git push -u origin main
   ```
2. Truy cập [Vercel](https://vercel.com) ➔ chọn **Add New...** ➔ **Project**.
3. Chọn repo GitHub vừa push và bấm **Import**.
4. Tại mục **Environment Variables**, thêm 3 biến môi trường:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_YT_VIDEO_ID` (tùy chọn)
5. Bấm **Deploy**.

---

## 📺 4. Cách Đổi Video / Trực Tiếp Trận Đấu & Phòng

### Đổi Video:
- **Qua biến môi trường**: Sửa `NEXT_PUBLIC_YT_VIDEO_ID` trong `.env.local`.
- **Qua tham số URL `?v=`**:
  - Dạng ID: `http://localhost:3002?v=jfKfPfyJRdk`
  - Dạng link YouTube: `http://localhost:3002?v=https://www.youtube.com/watch?v=jfKfPfyJRdk`
  - Dạng link Live: `http://localhost:3002?v=https://www.youtube.com/live/jfKfPfyJRdk`

### Mở nhiều phòng xem khác nhau (`?room=`):
- Phòng mặc định: `http://localhost:3002` (phòng `room-cktg-1`)
- Phòng phụ: `http://localhost:3002?room=room-cktg-2`

### Bật chế độ đo FPS & thống kê hiệu năng 3D:
- Thêm `?debug=1` vào URL: `http://localhost:3002?debug=1`.

---

## 🎮 Điều Khiển & Phím Tắt (Phong cách Sansa Temple)

| Thao tác | Chức năng | Chi tiết |
| :--- | :--- | :--- |
| **Chạm vào ghế trống** | **Tự đi tới ngồi** | Nhân vật tự động tính toán đường đi theo lối đi tới ghế và ngồi xuống (cách chính, 1 chạm). |
| **Kéo chuột** | **Xoay Camera** | Xoay góc nhìn 360 độ xung quanh nhân vật. |
| **Lăn chuột** | **Zoom Camera** | Phóng to / thu nhỏ khoảng cách camera (tự khóa chống xuyên tường). |
| **Click sàn / WASD** | **Đi lại tự do** | Dùng phím `W`, `A`, `S`, `D` hoặc click trực tiếp lên sàn khán phòng để di chuyển. |
| **Cần gạt ảo (Mobile)** | **Joystick di chuyển** | Xuất hiện góc dưới bên trái màn hình cảm ứng để di chuyển tiện lợi trên điện thoại. |
| **Phím `E`** | **Ngồi / Đứng dậy** | Khi lại gần ghế trống (< 1.5 đơn vị), bấm `E` để ngồi. Đang ngồi bấm `E` hoặc nút "Đứng dậy" để rời ghế. |
| **Phím `C`** | **Màn Chiếu Toàn Cảnh** | Chuyển camera nhìn thẳng chính diện vào màn chiếu YouTube. Bấm lại để trở về camera theo dõi nhân vật. |
| **Nút "Theo dõi"** | **Camera Focus** | Bật toggle `🎥 Theo dõi` để camera tự động lia tới người khác khi họ làm hành động gáy / hò hét. |
| **Phím `1`** | **😮💨 Thở Oxi** | Bò khỏi ghế → bò ra lối đi bên trái → đến bình oxi gần nhất → đeo mặt nạ thở 6s rồi bò về ghế. Ghế được giữ chỗ. |
| **Phím `2`** | **🐓 Gáy bẩn** | Ưỡn ngực, ngửa đầu, hiện chữ "Ò Ó O! Dễ!!" + âm thanh gà gáy sawtooth. |
| **Phím `3`** | **📣 Hò hét** | Cơ thể rung lắc mạnh, chữ "AAAAAA!" + âm thanh hét bandpass. |
| **Phím `4`** | **🙌 SIUUU** | Bật nhảy 360 độ, bắn tung 18 mảnh pháo giấy 3D + âm thanh SIUUU Ronaldo. |
| **Enter** | **💬 Chat** | Hiện bong bóng thoại 3D trên đầu nhân vật trong 5 giây. |
| **Nút Live** | **Về LIVE** | Hiện trên màn chiếu khi video trực tiếp bị trễ quá 8 giây. |

---

## ⚡ Các Kỹ Thuật Tối Ưu Đạt 60fps

1. **InstancedMesh cho 60 ghế**: Toàn bộ đệm và tựa lưng của 60 ghế được vẽ bằng `InstancedMesh`, giảm số lượng draw call từ hàng trăm xuống chỉ 1-2 draw call.
2. **Không setState mỗi frame**: Mọi biến đổi vị trí nhân vật, camera và animation được cập nhật trực tiếp trên Three.js Object3D bên trong `useFrame`.
3. **Nội suy chuyển động Damping**: Vị trí truyền nhận qua mạng được làm mượt bằng `MathUtils.damp` giúp nhân vật người khác lướt đi êm ru ở 60fps mà không bị khựng giật.
4. **1 Shadow Light + 1024 Map**: Giới hạn chỉ 1 nguồn sáng đổ bóng để GPU chạy nhẹ nhàng ngay cả trên laptop văn phòng và điện thoại.
5. **Adaptive DPR**: Sử dụng `<PerformanceMonitor>` tự động cân chỉnh độ nét và hiệu năng khi khung hình có dấu hiệu tụt dốc.
