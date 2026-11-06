# Esports Watch Party 3D · CKTG LMHT 🏆 (v3.1.0)

Ứng dụng web xem chung trận Chung Kết Thế Giới (CKTG) Liên Minh Huyền Thoại trong một **rạp chiếu phim 3D** sống động và tối ưu hóa hiệu năng cao. Khán giả điều khiển nhân vật Chibi 3D phong cách hoạt hình (cel-shading), tự do đi lại trong khán phòng, click vào ghế để ngồi, trò chuyện, gáy bẩn, hò hét, ăn mừng SIUUU, xem video đồng bộ thời gian thực và tính năng **"Thở Oxi"** nhịp điệu khẩn cấp khi đội nhà lâm nguy!

---

## 🎮 Hệ Thống Điều Khiển & Camera v3.1 (Roblox Style & FPS)

- **Di chuyển**: Phím `W`, `A`, `S`, `D` hoặc các phím mũi tên. Hướng di chuyển tự động bám theo góc nhìn camera.
- **Tương tác ghế ngồi**: Nhấn `E` hoặc click chuột vào ghế trống để tự động tìm đường đến ngồi. Nhấn `E` hoặc bất kỳ phím `W`, `A`, `S`, `D` để đứng dậy an toàn vào lối đi phía trước.
- **Roblox Stepped Zoom (9 nấc khoảng cách cố định)**:
  - Nấc: `[0, 2.5, 4, 6, 8.5, 12, 17, 24, 35]`. Mặc định ở nấc 6.0.
  - Lăn chuột lên (scroll up) hoặc bấm phím `I` $\to$ zoom In 1 nấc.
  - Lăn chuột xuống (scroll down) hoặc bấm phím `O` $\to$ zoom Out 1 nấc.
  - Chuyển nấc nội suy mượt nhẹ `~0.15s`.
- **Góc nhìn thứ nhất (First-Person View / FPS - Nấc 0)**:
  - Camera đặt tại mắt nhân vật ($y + 1.5$), ẩn hoàn toàn model của chính mình để không cản trở màn hình chiếu.
  - Chuột xoay tự do theo mọi góc nhìn $[-80^\circ, +80^\circ]$. Hỗ trợ Pointer Lock khi click vào canvas (`Esc` để nhả chuột).
  - Khi ngồi ghế ở chế độ FPS: nhìn thẳng màn chiếu, có thể quay đầu nhìn xung quanh rạp như người thật.
- **Hoạt ảnh Thở Oxi nhịp điệu (1.6s/chu kỳ)**:
  - Tư thế quỳ gối, một tay giữ mặt nạ; pha hít (0.8s) thân nở to `1.12`, vai nhô, đầu ngửa, dây thở phát sáng, bay chữ "Hííít…"; pha thở (0.8s) thân hạ, đầu cúi, phụt cụm bong bóng hơi nước quanh mặt nạ, bay chữ "Phùùù…". Kèm âm thanh rít van cao tần và tiếng thở ra êm dịu.
- **Tự do góc nhìn khi làm Action**: Không bao giờ khóa camera khi gáy bẩn / hò hét / SIUUU / thở oxi. Người dùng luôn toàn quyền xoay chuột và zoom.

---

## 🛠 Tech Stack & Kiến Trúc v3.1

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
- **Bảo mật & Server Authorization (v3 O3)**:
  - **Xác thực Admin bằng `timingSafeEqual`**: Header `x-admin-key` được so sánh với `process.env.ADMIN_KEY` bảo mật chống timing attack. TUYỆT ĐỐI không fallback mật khẩu trong code.
  - **Client không tin broadcast**: Video màn chiếu, banner và đèn rạp được đồng bộ qua bảng `room_config` (Supabase Postgres Changes CDC). Khán giả thông thường không thể can thiệp hoặc giả mạo.
  - **Phân quyền chức năng**: Khán giả thấy nút **"💡 Đề xuất video"** (`POST /api/suggest`). Admin thấy nút **"📺 Đổi video"** (`POST /api/admin/config`).
  - **Rate Limiting bằng Database**: Hàm atomic SQL `check_rate_limit()` trên bảng `rate_limits` bảo vệ serverless routes (Chat: 1/s, Đề xuất: 3/phút, Báo cáo: 5/phút, Admin: 10/phút).
  - **Lưu Chat qua Server**: Lọc từ ngữ thô tục (`lib/badwords.ts`) và kiểm soát độ dài $\le 60$ ký tự ở server. Anon không có quyền INSERT trực tiếp vào `chat_log`.
  - **Error Boundary**: Bắt lỗi WebGL crash (`components/WebGLErrorBoundary.tsx`) hiển thị thông báo thân thiện và nút tải lại trang.

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

## ☁️ 2. Hướng Dẫn Cài Đặt Supabase & Deploy Vercel

### Bước 1: Cài đặt Supabase Database (Bắt buộc chạy file `supabase/schema.sql`)
1. Đăng nhập [Supabase Dashboard](https://supabase.com/dashboard) và tạo project mới (hoặc chọn project có sẵn).
2. Mở mục **SQL Editor** trong thanh menu bên trái.
3. Mở file [supabase/schema.sql](supabase/schema.sql) trong project, sao chép toàn bộ nội dung, dán vào SQL Editor và nhấn nút **Run**.
   - Script này an toàn và có tính lũy kế (idempotent: `if not exists`, `drop policy if exists`).
   - Sẽ khởi tạo các bảng: `room_config`, `chat_log`, `reports`, `video_suggestions`, `rate_limits`.
   - Thiết lập hàm bảo mật `check_rate_limit` và kích hoạt realtime CDC trên `room_config`.
   - Thiết lập Row Level Security (RLS) khóa toàn bộ quyền ghi của người dùng nặc danh (anon).

### Bước 2: Bảng Biến Môi Trường (Public vs Server-Only)

Tạo file `.env.local` ở máy phát triển và cấu hình các biến sau trên **Vercel Settings ➔ Environment Variables**:

| Tên biến môi trường | Loại | Mô tả & Cách lấy |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **Public** (Client & Server) | URL của Supabase project (`https://<project-ref>.supabase.co`). Tìm tại Supabase Settings ➔ API. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **Public** (Client & Server) | Khóa `anon` công khai. Khán giả chỉ có quyền SELECT `room_config` và `chat_log`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Server-Only** (Tuyệt mật) | Khóa quản trị `service_role`. Chỉ Server API dùng để ghi dữ liệu, duyệt đề xuất, lưu chat. **KHÔNG** thêm tiền tố `NEXT_PUBLIC_`! |
| `ADMIN_KEY` | **Server-Only** (Tuyệt mật) | Khóa bí mật dùng để xác thực Quản trị viên (đổi video, cập nhật banner, duyệt đề xuất). Không có giá trị mặc định. |
| `NEXT_PUBLIC_DEFAULT_VIDEO_ID` | **Public** (Client & Server) | (Tùy chọn) YouTube Video ID mặc định nếu phòng chưa được cấu hình (mặc định: `jfKfPfyJRdk`). |

### Bước 3: Checklist An Toàn Trước Khi Chia Sẻ Link Công Khai

Trước khi gửi link phòng xem cho đông đảo bạn bè hoặc cộng đồng, hãy kiểm tra danh sách sau:
- [ ] **Đã chạy `supabase/schema.sql` mới nhất** trong Supabase SQL Editor.
- [ ] **Đã đặt `ADMIN_KEY`** phức tạp trên Vercel Environment Variables.
- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** không bị rò rỉ ra client (chỉ đọc trong Server API).
- [ ] Thử nghiệm với người dùng ẩn danh: Người thường chỉ thấy nút **"💡 Đề xuất video"**, không thể đổi video bừa bãi.
- [ ] Endpoint `/api/admin/config` trả về HTTP 401 khi không gửi kèm header `x-admin-key`.

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
- **Quản lý Video & Kiểm duyệt**:
  - Người thường: Nút **"💡 Đề xuất video"** gửi link YouTube tới Quản trị viên.
  - Quản trị viên: Đăng nhập bằng `ADMIN_KEY` để mở nút **"📺 Đổi video"** trực tiếp trong rạp, hoặc truy cập `/admin?key=<ADMIN_KEY>` để duyệt danh sách đề xuất.
  - Nhấp vào bất kỳ người chơi nào trong rạp để mở bảng điều khiển:
    - 🔇 **Ẩn người này**: Ẩn toàn bộ tin nhắn chat và hành động của người đó.
    - 🚩 **Báo cáo vi phạm**: Gửi báo cáo kèm lý do vi phạm về hệ thống quản trị.
  - Hệ thống tự động lọc các từ ngữ thô tục trước khi hiển thị bóng chat.
