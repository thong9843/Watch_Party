# Esports Watch Party 3D · CKTG LMHT 🏆 (v3.0.0)

Ứng dụng web xem chung trận Chung Kết Thế Giới (CKTG) Liên Minh Huyền Thoại trong một **rạp chiếu phim 3D** sống động và tối ưu hóa hiệu năng cao. Khán giả điều khiển nhân vật Chibi 3D phong cách hoạt hình (cel-shading) góc nhìn thứ 3 theo phong cách một chạm đơn giản (Sansa Temple), tự do đi lại trong khán phòng, click vào ghế để ngồi, trò chuyện, gáy bẩn, hò hét, ăn mừng SIUUU và tính năng **"Thở Oxi"** 3D khẩn cấp khi đội nhà lâm nguy!

---

## 🛠 Tech Stack & Kiến Trúc v3

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript.
- **3D Graphics & Instancing**:
  - `three@0.174.0`, `@react-three/fiber@9.0.4`, `@react-three/drei@10.7.9`.
  - **Gộp Mesh (`mergeGeometries`)**: Toàn bộ nhân vật gồm tối đa 2 mesh (thân áo + đầu/tóc/chi với Vertex Colors).
  - **InstancedMesh cho người khác**: 60+ nhân vật được vẽ bằng đúng 2–4 draw calls thay vì >600 draw calls.
  - **Hệ thống LOD & Giới hạn nhãn tên 3D**: Chỉ hiển thị tối đa 20 nhãn tên gần camera nhất và trong tầm nhìn.
  - **Confetti Pool chung**: Duy nhất 1 InstancedMesh pool 300 hạt xử lý tối đa 8 hiệu ứng ăn mừng đồng thời.
  - **Âm thanh không gian & Giới hạn âm thanh**: Âm thanh action ở khoảng cách >20m tự động giảm âm lượng theo khoảng cách; giới hạn tối đa 4 âm thanh action cùng lúc.
  - **Tùy chọn chất lượng đồ họa**: Nút `✨ Chất lượng` (Tự động / Thấp / Vừa / Cao) lưu vào localStorage. Mức "Thấp" tự động tắt Outlines, tắt Banner Glow, đặt DPR 1.0.
- **Tối ưu mạng Supabase (v3 O2)**:
  - **Gói tin vị trí siêu gọn**: Định dạng mảng `[id, x, z, rotY, pose]` giảm gần 70% kích thước payload.
  - Tần suất gửi tối đa $\le 5$ gói/giây khi di chuyển, đứng yên hoặc ngồi ghế = 0 gói/giây.
  - **Chống spam**: Rate limit chat 1 tin/s (tối đa 60 ký tự), action cooldown 4s. Phía nhận tự động lọc spam.
  - **Tự động chia phòng (Auto room partition)**: Mỗi phòng tối đa 60 người (`Phòng 1`, `Phòng 2`, `Phòng 3`,...). Tự động chuyển phòng khi đầy; người dùng có thể tự chọn phòng trong sảnh chờ.
- **Bảo mật & Database (v3 O3)**:
  - `supabase/schema.sql` hoàn chỉnh với Row Level Security (RLS) cho `room_config`, `chat_log` (tự động dọn dẹp sau 7 ngày), `reports`.
  - Server-only API `POST /api/admin/config` với `SUPABASE_SERVICE_ROLE_KEY` và IP rate limit (5 lần/phút/IP).
  - Báo cáo người chơi (`POST /api/report`), tính năng ẩn/mute người chơi tại client (`muted_users`), bộ lọc từ ngữ thô tục tự động (`lib/badwords.ts`).
  - Error Boundary bắt lỗi WebGL crash (`components/WebGLErrorBoundary.tsx`) hiển thị thông báo thân thiện và nút tải lại trang.
  - GitHub Actions CI workflow (`.github/workflows/ci.yml`).

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

> **Mẹo test 60 người (Bot Simulation):** Thêm query parameter `?bots=60` trên URL:
> `http://localhost:3002?bots=60`
> Hệ thống sẽ tự động kích hoạt 60 bot khán giả ngồi kín ghế, đi lại trong lối đi, hò hét, chat và ăn mừng SIUUU ngẫu nhiên để bạn kiểm tra độ mượt 60 FPS!

---

## ☁️ 2. Hướng Dẫn Deploy Vercel & Supabase

### Bước 1: Thiết lập Supabase Database & RLS
1. Mở [Supabase Dashboard](https://supabase.com/dashboard) ➔ Tạo dự án mới.
2. Vào **SQL Editor** ➔ Mở file `supabase/schema.sql` trong dự án này, dán toàn bộ nội dung và bấm **Run**.
3. Vào **Project Settings** ➔ **API** để lấy các khóa bảo mật.

### Bước 2: Thiết lập biến môi trường trên Vercel
Thêm các biến môi trường sau vào dự án trên Vercel:

| Biến môi trường | Ý nghĩa | Phạm vi |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL dự án Supabase | Client + Server |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Khóa `anon` công khai của Supabase | Client + Server |
| `SUPABASE_SERVICE_ROLE_KEY` | Khóa `service_role` quản trị bảo mật cao | **Server-only** (Bảo mật) |
| `NEXT_PUBLIC_DEFAULT_VIDEO_ID` | ID video mặc định (VD: `dQw4w9WgXcQ`) | Client + Server |
| `ADMIN_KEY` | Mật khẩu truy cập trang `/admin` | Server |

### Bước 3: Deploy lên Vercel
- Đẩy code lên GitHub repository.
- Kết nối repo với Vercel và bấm **Deploy**.
- GitHub Actions CI (`.github/workflows/ci.yml`) sẽ tự động kiểm tra type check và build mỗi khi push code lên `main`.

---

## 🎮 3. Tính Năng & Điều Khiển

- **Góc nhìn camera**: Góc nhìn thứ 3 điện ảnh nhìn rõ nhân vật ở 65–80% khung hình và màn chiếu ở 10–45%. Cuộn con lăn chuột để zoom xa (từ 3m tới 24m).
- **Điều khiển**:
  - Chế độ bàn phím: `WASD` di chuyển theo hướng camera, giữ chuột trái kéo để xoay góc nhìn, `E` ngồi ghế / đứng dậy, `C` xem cận cảnh màn chiếu.
  - Chế độ chuột: Click trực tiếp vào sàn hoặc ghế để nhân vật tự tìm đường đi tới.
- **Hành động & Cảm xúc**:
  - Phím `1`: Thở Oxi khẩn cấp (bò tới bình oxi, đeo mặt nạ có ống thở 3D).
  - Phím `2`: Gáy bẩn ("Ò Ó O!").
  - Phím `3`: Hò hét ("AAAAAA!").
  - Phím `4`: Ăn mừng SIUUU (nhảy xoay vòng kèm hiệu ứng pháo giấy confetti).
- **Điều hòa & Kiểm duyệt**:
  - Nhấp vào bất kỳ người chơi nào trong rạp để mở bảng điều khiển:
    - 🔇 **Ẩn người này**: Ẩn toàn bộ tin nhắn chat và hành động của người đó.
    - 🚩 **Báo cáo vi phạm**: Gửi báo cáo kèm lý do vi phạm về hệ thống quản trị.
  - Hệ thống tự động lọc các từ ngữ thô tục trước khi hiển thị bóng chat.
