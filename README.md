# Esports Watch Party 3D · CKTG LMHT 🏆

Ứng dụng web xem chung trận Chung Kết Thế Giới (CKTG) Liên Minh Huyền Thoại trong một **rạp chiếu phim 3D** sống động. Người tham gia điều khiển nhân vật Chibi 3D góc nhìn thứ 3 theo phong cách một chạm đơn giản (Sansa Temple), tự do đi lại trong khán phòng, click vào ghế để ngồi, trò chuyện, gáy bẩn, hò hét, ăn mừng SIUUU và đặc biệt là tính năng **"Thở Oxi"** 3D khẩn cấp khi đội nhà lâm nguy!

---

## 🛠 Tech Stack (Bản 3D v2)

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript.
- **3D Graphics**: `three@0.174.0`, `@react-three/fiber@9.0.4`, `@react-three/drei@10.7.9` (đã ghim version cố định).
- **State tần suất cao**: `zustand@5.0.3` (quản lý input, camera và vị trí realtime không gây re-render cây DOM).
- **Styling**: Pure CSS thuần (`app/globals.css`), **không dùng Tailwind**, không thư viện UI ngoài.
- **Realtime**: `@supabase/supabase-js` v2 (Broadcast + Presence, **không cần tạo bảng database**).
- **Fallback Local**: Tự động chuyển sang `BroadcastChannel` khi không có Supabase env để test nhiều tab cùng máy (`localhost:3002`).
- **Video**: YouTube IFrame Player API (nhúng mặt phẳng 3D bằng `<Html transform>`, không restream, không vi phạm bản quyền).
- **Âm thanh**: Web Audio API tự tổng hợp bằng thuật toán toán học (gà gáy, hò hét, SIUUU, pop chat, xả van oxi), không cần file MP3.
- **Model nhân vật**: Dựng bằng Three.js low-poly primitives (chibi đầu to, thân đổi màu theo người dùng chọn), chạy mượt mà 60fps trên mọi thiết bị.
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

## 📺 3. Quản Lý Nguồn Video & Trang Admin

Hệ thống hỗ trợ chuỗi ưu tiên video linh hoạt:
**Tham số URL `?v=` > Video do Admin phát tán qua Realtime > Biến môi trường `NEXT_PUBLIC_YT_VIDEO_ID`**.

### Bảng Điều Khiển Admin (`/admin?key=<ADMIN_KEY>`):
- Đăng nhập vào trang Admin: **[http://localhost:3002/admin?key=admin123](http://localhost:3002/admin?key=admin123)**.
- Khóa bảo mật: `ADMIN_KEY=admin123` (cấu hình trong file `.env.local`).
- Chức năng: Dán link YouTube hoặc video ID bất kỳ, bấm **"Đổi video phòng ngay"**. Màn chiếu của tất cả người xem trong phòng sẽ tự động chuyển sang video mới tức thì mà không cần F5 trình duyệt.
- Người dùng thông thường không có key sẽ bị chặn bởi màn hình `403 Forbidden`.

### Đổi Video Nhanh Cho Cá Nhân:
- Thêm tham số `?v=` vào URL:
  - Dạng ID: `http://localhost:3002?v=jfKfPfyJRdk`
  - Dạng link: `http://localhost:3002?v=https://www.youtube.com/watch?v=jfKfPfyJRdk`

---

## 🎮 4. Điều Khiển & Phím Tắt

Khi vừa vào rạp, người xem được chọn 1 trong 2 chế độ điều khiển (có thể đổi lại bất kỳ lúc nào bằng nút **⚙️ Điều khiển** trên thanh tiêu đề):

| Chế độ | Di chuyển | Xoay camera | Chi tiết |
| :--- | :--- | :--- | :--- |
| **⌨️ Bàn phím (Mặc định)** | **WASD / Mũi tên** | **Giữ chuột TRÁI + Kéo** | WASD di chuyển tương đối theo hướng nhìn camera. Click ghế trống để tự đi tới ngồi. |
| **🖱️ Chuột (Point & Click)** | **Click sàn / ghế** | **Giữ chuột PHẢI + Kéo** | Click lên sàn để đi tới theo lối đi. Kéo chuột > 5px để xoay góc nhìn mượt mà. |

### Các Phím Tắt Tiện Ích:
| Phím | Chức năng | Chi tiết |
| :--- | :--- | :--- |
| **`Z`** | **Góc Camera Gần / Xa** | Chuyển đổi giữa 2 mức khoảng cách: Xa (~6.5) và Gần (~4.2). |
| **`E`** | **Ngồi / Đứng dậy** | Ngồi vào ghế gần nhất hoặc đứng dậy ra lối đi trước dãy ghế (đang ngồi bấm WASD cũng tự đứng dậy). |
| **`C`** | **Xem Màn Chiếu** | Lia thẳng camera vào màn chiếu YouTube toàn cảnh. |
| **`1`** | **😮💨 Thở Oxi** | Bò ra trạm bình oxi để nạp khí khẩn cấp trong 6 giây rồi quay về ghế. |
| **`2`** | **🐓 Gáy bẩn** | Ưỡn ngực gáy "Ò Ó O! Dễ!!" kèm hiệu ứng âm thanh. |
| **`3`** | **📣 Hò hét** | Rung lắc cơ thể, la hét cổ vũ đội tuyển. |
| **`4`** | **🙌 SIUUU** | Bật nhảy 360 độ, bắn tung 18 mảnh pháo hoa giấy rực rỡ. |
| **`Enter`** | **💬 Trò chuyện** | Hiện bong bóng chat 3D sống động trên đầu nhân vật. |

---

## ⚡ 5. Các Kỹ Thuật Tối Ưu Đạt 60fps

1. **Không setState mỗi frame**: Mọi biến đổi vị trí nhân vật, camera và animation được cập nhật trực tiếp trên Three.js ref bên trong `useFrame`.
2. **InstancedMesh cho 60 ghế**: Toàn bộ đệm và tựa lưng của 60 ghế được vẽ bằng `InstancedMesh`, giảm số lượng draw call từ hàng trăm xuống chỉ 1-2 draw call.
3. **Nội suy chuyển động Damping**: Vị trí truyền nhận qua mạng được làm mượt bằng `MathUtils.damp` giúp nhân vật người khác lướt đi êm ru ở 60fps.
4. **Giảm thiểu gói tin broadcast**: Vị trí chỉ gửi tối đa 10 gói/giây khi đang di chuyển, làm tròn 2 chữ số thập phân, không gửi khi đang ngồi hoặc đứng yên.
5. **Adaptive DPR**: Sử dụng `<PerformanceMonitor>` tự động cân chỉnh độ nét và hiệu năng khi khung hình có dấu hiệu tụt dốc.
