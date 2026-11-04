# Esports Watch Party 3D · CKTG LMHT 🏆 (v2.1)

Ứng dụng web xem chung trận Chung Kết Thế Giới (CKTG) Liên Minh Huyền Thoại trong một **rạp chiếu phim 3D** sống động. Người tham gia điều khiển nhân vật Chibi 3D phong cách hoạt hình (cel-shading) góc nhìn thứ 3 theo phong cách một chạm đơn giản (Sansa Temple), tự do đi lại trong khán phòng, click vào ghế để ngồi, trò chuyện, gáy bẩn, hò hét, ăn mừng SIUUU và tính năng **"Thở Oxi"** 3D khẩn cấp khi đội nhà lâm nguy!

---

## 🛠 Tech Stack (Bản 3D v2.1)

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript.
- **3D Graphics**: `three@0.174.0`, `@react-three/fiber@9.0.4`, `@react-three/drei@10.7.9` (đã ghim version cố định).
- **Styling & Shading**:
  - Pure CSS thuần (`app/globals.css`), **không dùng Tailwind**, không thư viện UI ngoài.
  - Cel / Toon Shading (`meshToonMaterial`) + `<Outlines>` sắc nét cho nhân vật.
  - Blob Shadows (plane tròn radial gradient) thay thế toàn bộ shadow maps nặng nề.
  - Sương mờ nhẹ `<fog>` + `ACESFilmicToneMapping` cho độ sâu rạp chiếu phim chuẩn điện ảnh.
- **State tần suất cao**: `zustand@5.0.3` + Shared Three.js Refs (`lib/playerRefs.ts`).
- **Realtime**: `@supabase/supabase-js` v2 (Broadcast + Presence, **không cần tạo bảng database**).
- **Fallback Local**: Tự động chuyển sang `BroadcastChannel` khi không có Supabase env để test nhiều tab cùng máy (`localhost:3002`).
- **Video**: YouTube IFrame Player API (nhúng mặt phẳng 3D bằng `<Html transform>`, không restream, không vi phạm bản quyền).
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

## 📺 3. Quản Lý Nguồn Video & Trang Admin

Hệ thống hỗ trợ chuỗi ưu tiên video linh hoạt:
**Tham số URL `?v=` > Video do Admin phát tán qua Realtime > Biến môi trường `NEXT_PUBLIC_YT_VIDEO_ID`**.

### Bảng Điều Khiển Admin (`/admin?key=<ADMIN_KEY>`):
- Đăng nhập vào trang Admin: **[http://localhost:3002/admin?key=admin123](http://localhost:3002/admin?key=admin123)**.
- Khóa bảo mật: `ADMIN_KEY=admin123` (cấu hình trong file `.env.local`).
- Chức năng: Dán link YouTube hoặc video ID bất kỳ, bấm **"Đổi video phòng ngay"**. Màn chiếu của tất cả người xem trong phòng sẽ tự động chuyển sang video mới tức thì mà không cần F5 trình duyệt.
- Người dùng thông thường không có key sẽ bị chặn bởi màn hình `403 Forbidden`.

---

## 🎮 4. Điều Khiển, Phím Tắt & Tính Năng Mới (v2.1)

### Màn Hình Chờ / Lobby 3D Tương Tác:
- Khi vừa vào trang, bạn ở chế độ **Khán Giả 3D**: rạp 3D thật xoay chậm từ góc cao isometric, hiển thị mọi hoạt động của các khán giả đang có trong phòng.
- Chọn nickname, màu áo (xem trước chibi) và cách thao tác ngay trên thẻ trung tâm.
- Bấm **"Vào rạp thưởng thức trận đấu 🎬"**: Camera thực hiện cú lướt mượt mà 1.2s từ trên cao xuống lối vào khán phòng.

### Điều Khiển & Phím Tắt:
| Chế độ | Di chuyển | Xoay camera | Chi tiết |
| :--- | :--- | :--- | :--- |
| **⌨️ Bàn phím (Mặc định)** | **WASD / Mũi tên** | **Giữ chuột TRÁI + Kéo** | WASD di chuyển tương đối theo hướng nhìn camera. Click ghế trống để tự đi tới ngồi. |
| **🖱️ Chuột (Point & Click)** | **Click sàn / ghế** | **Giữ chuột PHẢI + Kéo** | Click lên sàn để đi tới theo lối đi. Kéo chuột > 5px để xoay góc nhìn mượt mà. |

### Các Phím Tắt Tiện Ích:
| Phím | Chức năng | Chi tiết |
| :--- | :--- | :--- |
| **`Z`** | **Góc Camera Gần / Xa** | Chuyển đổi giữa 2 mức khoảng cách: Xa (~6.8) và Gần (~4.5). |
| **`E`** | **Ngồi / Đứng dậy** | Ngồi vào ghế gần nhất hoặc đứng dậy ra lối đi trước dãy ghế (đang ngồi bấm WASD cũng tự đứng dậy). |
| **`C`** | **Xem Màn Chiếu** | Lia thẳng camera vào màn chiếu YouTube toàn cảnh. |
| **`1`** | **😮💨 Thở Oxi** | Bò ra trạm bình oxi để nạp khí khẩn cấp trong 6 giây rồi quay về ghế. |
| **`2`** | **🐓 Gáy bẩn** | Ưỡn ngực gáy "Ò Ó O! Dễ!!" kèm hiệu ứng âm thanh. |
| **`3`** | **📣 Hò hét** | Rung lắc cơ thể, la hét cổ vũ đội tuyển. |
| **`4`** | **🙌 SIUUU** | Bật nhảy 360 độ, bắn tung 18 mảnh pháo hoa giấy rực rỡ. |
| **`Enter`** | **💬 Trò chuyện** | Hiện bong bóng chat 3D sống động trên đầu nhân vật (Troika GPU text). |

---

## ⚡ 5. Các Tối Ưu Triệt Tiêu Giật & Đạt 60fps Bền Vững (v2.1)

1. **Triệt tiêu Garbage Collection (Zero Object Allocation in `useFrame`)**: Mọi vector, quaternion, matrix dùng để tính toán camera, hướng di chuyển, hạt pháo giấy được tái sử dụng qua các biến tĩnh ở module scope.
2. **Loại bỏ DOM `<Html>` quá tải**: Chuyển toàn bộ tên nhân vật, bong bóng chat, action pill, nhãn bình oxi và tooltip sang `<Billboard>` + Troika `<Text>` 3D chạy trực tiếp trong WebGL trên GPU. Duy nhất 1 `<Html>` được giữ lại cho iframe YouTube.
3. **Loại bỏ PointLight runtime**: Các bình oxi đang sử dụng chuyển sang phát sáng bằng `emissiveIntensity` của vật liệu toon, không mount/unmount light lúc runtime.
4. **Hệ đèn cố định & Nút 💡 Đèn rạp**: Tối đa 3 light thật trong scene, hỗ trợ nút bấm chuyển đổi giữa chế độ sáng ấm và chế độ xem phim dịu mắt (lerp 0.6s).
5. **Blob Shadows thay cho Realtime Shadow Maps**: Mỗi nhân vật sở hữu 1 plane tròn radial gradient mỏng trên mặt sàn, nhẹ gấp 10 lần shadow maps mà vẫn giữ được tính thẩm mỹ hoạt hình.
6. **Adaptive DPR**: Desktop [1.25, 2.0], Mobile [1.0, 1.5], tự động điều chỉnh từng nấc 0.25 để không bị giật khung hình đột ngột.
