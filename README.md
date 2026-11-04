# Esports Watch Party · CKTG LMHT 🏆

Ứng dụng web xem chung trận Chung Kết Thế Giới (CKTG) Liên Minh Huyền Thoại trong một "rạp chiếu phim" ảo. Mỗi người tham gia là một nhân vật Chibi ngồi trên ghế khán phòng, có thể trò chuyện, hò hét, gáy bẩn, ăn mừng SIUUU và đặc biệt là tính năng **"Thở Oxi"** khẩn cấp khi đội nhà bị dẫn trước!

---

## 🛠 Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript.
- **Styling**: Pure CSS thuần (`globals.css`), không sử dụng Tailwind hay thư viện UI/animation bên ngoài.
- **Realtime**: `@supabase/supabase-js` v2 (sử dụng Realtime Broadcast + Presence, **không cần tạo bảng database**).
- **Fallback Local**: Tự động chuyển sang `BroadcastChannel` khi không cấu hình Supabase để test nhiều tab trên cùng một máy mà không cần tài khoản cloud.
- **Video**: YouTube IFrame Player API (chỉ embed player chính chủ, không restream).
- **Âm thanh**: Web Audio API tự tổng hợp âm thanh bằng code toán học (gà gáy, hò hét, SIUUU, pop chat, phì oxi), không cần tải file MP3.
- **Deploy**: Vercel ready (`reactStrictMode: false`).

---

## 🚀 1. Hướng Dẫn Chạy Local

Chỉ cần Node.js (v18 trở lên):

```bash
# 1. Cài đặt dependencies
npm install

# 2. Khởi chạy server phát triển
npm run dev
```

Mở trình duyệt tại: [http://localhost:3000](http://localhost:3000).

> **Mẹo test nhiều người:** Mở 2 đến 3 tab khác nhau (hoặc 1 tab ẩn danh, 1 tab thường) tại `http://localhost:3000`. Hệ thống sẽ tự động bật **Demo local** thông qua `BroadcastChannel`. Mọi hành động chọn ghế, chat, gáy bẩn, thở oxi sẽ đồng bộ tức thì giữa các tab!

---

## ☁️ 2. Kết Nối Supabase Miễn Phí (Online Multi-device)

Để bạn bè trên khắp mọi nơi cùng vào xem chung phòng:

1. Đăng ký tài khoản miễn phí tại [Supabase](https://supabase.com).
2. Bấm **New Project** và đặt tên cho dự án (ví dụ: `esports-watch-party`).
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

*(Không cần chạy bất kỳ câu lệnh SQL hay tạo bảng nào trong Supabase vì ứng dụng sử dụng cơ chế Realtime Presence & Broadcast)*.

Khởi động lại `npm run dev`, góc trên màn hình sẽ hiện huy hiệu xanh lá `● ONLINE`.

---

## 🌐 3. Triển Khai Lên Vercel (Deploy)

1. Đẩy mã nguồn lên kho lưu trữ GitHub của bạn:
   ```bash
   git init
   git add .
   git commit -m "feat: esports watch party cinema"
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
5. Bấm **Deploy**. Vercel sẽ tự động build và cung cấp đường dẫn web công khai để gửi cho bạn bè!

---

## 📺 4. Cách Đổi Video / Trực Tiếp Trận Đấu

Có 2 cách linh hoạt để phát bất kỳ video hay luồng trực tiếp YouTube nào:

### Cách 1: Qua biến môi trường
Sửa giá trị `NEXT_PUBLIC_YT_VIDEO_ID` trong file `.env.local` hoặc trên Vercel:
```env
NEXT_PUBLIC_YT_VIDEO_ID=jfKfPfyJRdk
```

### Cách 2: Qua tham số URL `?v=` (Cực kỳ tiện lợi)
Trực tiếp chèn link YouTube hoặc ID vào đường dẫn phòng:
- Dạng ID: `http://localhost:3000?v=jfKfPfyJRdk`
- Dạng link đầy đủ: `http://localhost:3000?v=https://www.youtube.com/watch?v=jfKfPfyJRdk`
- Dạng link rút gọn: `http://localhost:3000?v=https://youtu.be/jfKfPfyJRdk`
- Dạng link Live: `http://localhost:3000?v=https://www.youtube.com/live/jfKfPfyJRdk`

Hệ thống có sẵn bộ lọc tự động trích xuất đúng 11 ký tự YouTube Video ID.

---

## 🎮 Các Tính Năng & Phím Tắt

| Phím tắt | Tên hành động | Hiệu ứng | Âm thanh |
| :---: | :--- | :--- | :--- |
| `1` | **😮💨 Thở Oxi** | Bò xuống sàn, bò ra lối đi tới bình oxi gần nhất, đeo mặt nạ thở 6s rồi bò về ghế | Tiếng "phì" xả van oxi |
| `2` | **🐓 Gáy bẩn** | Ưỡn ngực, ngửa đầu, hiện chữ "Ò Ó O! Dễ!!" | 4 nhịp gáy gà sawtooth sống động |
| `3` | **📣 Hò hét** | Rung lắc cơ thể, 3 vòng sóng âm đỏ tỏa ra từ đầu, chữ "AAAAAA!" | Tiếng hét cường độ cao bandpass + sawtooth |
| `4` | **🙌 SIUUU** | Bật nhảy 70px xoay 360 độ, tiếp đất giơ 2 tay, 16 bông pháo hoa giấy tung tóe | Tiếng gió "S" rồi ngân dài "IU" chuẩn CR7 |
| `Enter` | **💬 Chat** | Hiện bong bóng thoại trên đầu nhân vật trong 5 giây | Tiếng "Pop" nhẹ |
| `Click` | **Đổi / Đứng dậy** | Bấm ghế trống để ngồi hoặc đổi chỗ. Bấm lại ghế của mình để đứng dậy | - |
| `Nút Live` | **Về LIVE** | Xuất hiện khi xem video trực tiếp bị trễ quá 8 giây để tua nhanh về thời gian thực | - |

*(Lưu ý: Bạn phải chọn ghế ngồi trước khi thực hiện các hành động gáy/hò hét/thở oxi. Khi đang đi thở oxi, ghế của bạn sẽ được giữ chỗ và các hành động khác tạm khóa)*.

