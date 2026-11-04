# IMPLEMENT.md — Esports Watch Party (Demo)

> **Dành cho AI coding agent / dev mới.** Đọc hết file này trước khi code. Đây là nguồn sự thật (source of truth) cho spec.
> Khi hoàn thành một hạng mục, tick ✅ trong mục **Tiến độ** và commit kèm file này.

## 0. Tiến độ
- [ ] P1 Setup project, config, lớp realtime (Supabase + Local fallback)
- [ ] P2 JoinScreen + Screen (YouTube) + khung rạp
- [ ] P3 Hall: ghế, bình oxi, chọn ghế + xử lý tranh ghế
- [ ] P4 Chat bong bóng trên đầu
- [ ] P5 Gáy bẩn / Hò hét / SIUUU + âm thanh + cooldown
- [ ] P6 Thở oxi (bò → thở → bò về) đồng bộ
- [ ] P7 Responsive, test 3 tab, `npm run build` pass, deploy Vercel

## 1. Mục tiêu & phạm vi
- Web xem chung **1 phòng** LMHT CKTG (nguồn YouTube Live) trong **rạp chiếu phim ảo**. Mỗi người là nhân vật chibi ngồi ghế, chat & làm action realtime.
- Vào phòng bằng nickname + màu, **không login**. Tất cả dịch vụ **free**.
- **Ngoài phạm vi demo**: nhiều phòng, login, DB, admin, Hype Meter, dự đoán.

## 2. Tech stack (bắt buộc)
| Lớp | Công nghệ |
|---|---|
| App | Next.js 15 App Router, React 19, TypeScript |
| Style | CSS thuần `app/globals.css` — **không** Tailwind, **không** thư viện UI/animation |
| Realtime | `@supabase/supabase-js` v2 — Broadcast + Presence, **không tạo bảng** |
| Fallback | `BroadcastChannel` khi thiếu env Supabase (test nhiều tab) |
| Video | YouTube IFrame Player API (chỉ embed) |
| Âm thanh | Web Audio API tự tổng hợp, không file mp3 |
| Deploy | Vercel; `next.config`: `reactStrictMode: false` |

## 3. Env (`.env.example`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_YT_VIDEO_ID=jfKfPfyJRdk
```
- Thiếu Supabase → mode `local`, badge "Demo local"; có → badge "● ONLINE".
- Override video: `?v=<id | url>`. `extractId` hỗ trợ `watch?v=`, `youtu.be/`, `/live/`, `/embed/`, ID 11 ký tự.

## 4. Cấu trúc file
```
app/layout.tsx  app/page.tsx  app/globals.css
lib/types.ts  lib/realtime.ts  lib/layout.ts  lib/sfx.ts
components/JoinScreen.tsx  Room.tsx  Screen.tsx  Hall.tsx  Character.tsx  ActionBar.tsx
.env.example  .gitignore  README.md
```
`app/page.tsx` (client): chưa có profile → `JoinScreen`; có → `Room`. Đọc `?v=` bằng `window.location.search` trong effect.

## 5. Data model (`lib/types.ts`)
```ts
type ActionType = 'crow' | 'shout' | 'siuu';
interface Profile { id: string; name: string; color: string }
interface Member extends Profile {
  seat: string | null;      // vd "C5"
  seatAt: number;           // ms, thời điểm ngồi (dùng xử lý tranh ghế)
  oxygen: { tank: number; start: number } | null;
}
type RoomEvent =
  | { type: 'chat'; id: string; text: string }
  | { type: 'action'; id: string; action: ActionType };
```

## 6. Realtime (`lib/realtime.ts`)
```ts
interface RoomConn {
  mode: 'supabase' | 'local';
  track(m: Member): void; send(e: RoomEvent): void;
  onMembers(cb: (list: Member[]) => void): void;
  onEvent(cb: (e: RoomEvent) => void): void;
  close(): void;
}
createRoom(roomId: string, selfId: string): RoomConn
```
- **Supabase**: `channel('room-cktg', { config: { broadcast: { self: false }, presence: { key: selfId } } })`. Presence `sync` → lấy meta cuối mỗi key. Broadcast event `'evt'`. `track()` chỉ sau `SUBSCRIBED` (lưu pending nếu gọi sớm).
- **Local**: BroadcastChannel; gửi state khi đổi + heartbeat 2s; xóa member sau 6s im lặng; `hello` khi vào (các tab gửi lại state); `leave` khi đóng tab.
- Người gửi **tự áp dụng event của mình** ngay (không nhận lại broadcast của chính mình).
- ID: random mỗi lần load tab. Nickname/màu lưu `localStorage` (try/catch).
- Đóng tab / unmount → `close()`.

### Nguyên tắc đồng bộ
| Dữ liệu | Kênh | Lý do |
|---|---|---|
| seat, seatAt, oxygen | Presence | Người vào sau vẫn thấy |
| chat, crow, shout, siuu | Broadcast | Tức thời, không cần lưu |

- **Tranh ghế**: cùng `seat` → `seatAt` nhỏ hơn thắng (hòa so `id`). Người thua: `seat=null` + toast "Ghế vừa có người ngồi, chọn ghế khác nhé!".
- **Lệch đồng hồ (oxi)**: nhận session mới của người khác → nếu `|now - start| < 4000` dùng `Date.now()` làm mốc local, ngược lại dùng `start`. Cache theo key `${tank}-${start}`.

## 7. Bố cục & hằng số (`lib/layout.ts`) — giữ đúng số
- Hall: hệ tọa độ ảo **1000 × 600**, scale theo chiều rộng (ResizeObserver + `transform: scale`), không scroll ngang.
- `ROWS = A..F` (A gần màn hình, ở trên), `COLS = 10`.
- `seatPos(seat) = { x: 262 + col*68, y: 92 + row*86 }` — điểm ngồi trên đệm.
- `AISLE_X = 178` (lối đi dọc). Tường trái x 0–120, biển "TRẠM OXI".
- `TANK_COUNT = 7`; `tankPos(i) = { x: 64, y: 82 + i*76 }` (đáy bình, bình cao ~64).
- z-index = `Math.round(y)`.

## 8. UI (phong cách rạp: tối, đỏ nhung, ánh vàng ấm)
1. **Header**: "Watch Party · CKTG", số online, badge mode, nút mute.
2. **Screen**: YouTube 16:9 max ~960px, viền phát sáng, rèm đỏ 2 bên (gradient). `autoplay=1, mute=1, playsinline=1, rel=0`. Nếu `getVideoData().isLive` và trễ > 8s (`getDuration() - getCurrentTime()`) → nút **"Về LIVE"** (`seekTo(getDuration(), true)`). Tạo div con imperatively cho player; bọc `React.memo`.
3. **Hall**: tier tối mỗi dãy + nhãn A–F bên phải; ghế; bình oxi; nhân vật; ống thở (SVG overlay).
4. **ActionBar** (sticky đáy): input chat (max 60 ký tự, Enter gửi, 1 tin/giây) + 4 nút `😮‍💨 Thở oxi` `🐓 Gáy bẩn` `📣 Hò hét` `🙌 SIUUU`, hiển thị cooldown. Phím tắt **1–4** khi không focus input.
5. **JoinScreen**: "CKTG Watch Party", nickname 2–16 ký tự, 8 màu, preview nhân vật, nút "Vào rạp 🎬".

### Ghế
- Nút 52×56 tại `(x-26, y-48)`, SVG lưng ghế + 2 tay vịn + đệm đỏ.
- Trống: hiện mã ghế, hover sáng. Có người: disabled. Của mình: viền vàng, bấm lại = đứng dậy. Bấm ghế trống khác = đổi chỗ (`seatAt` mới).
- Đang đi thở oxi: ghế giữ chỗ (tag "giữ chỗ"), không được đổi ghế.
- Chưa ngồi → không hiện trong hall + banner "Chọn một ghế trống để ngồi".

### Nhân vật (`Character.tsx`)
- SVG chibi 60×68, gốc (0,0) = đáy giữa. Thân màu user, 2 tay (class `arm-l`/`arm-r`), đầu da `#ffdcb8`, tóc tối, 2 mắt.
- Miệng theo trạng thái: cười | há to (shout/siuu) | nhếch + mắt lim dim (crow) | mặt nạ xanh ngọc (breathe).
- Lồng: `.char` (left/top) > `.fx` (key = thời điểm fx để restart animation) > `.figure` (xoay pose) > `svg`.
- Tên dưới chân (của mình màu vàng). Chat bubble trắng có đuôi ở ~72px trên gốc, 5s. Chữ hiệu ứng ~100px, bay lên + mờ 2.6s.

## 9. Actions
Điều kiện chung: phải đang ngồi; khóa khi đang thở oxi; cooldown **4s**/action; nút mute toàn cục; audio bọc try/catch + resume AudioContext.

| Action | Animation | Chữ | Âm thanh (Web Audio) |
|---|---|---|---|
| 🐓 crow | Ưỡn ngực scale 1.15 + ngửa đầu | "Ò Ó O! Dễ!!" | 4 đoạn sawtooth glide 500→750, 750→620, 650→1000, 1000→520 + vibrato |
| 📣 shout | Rung lắc nhanh + 3 vòng sóng âm từ đầu | "AAAAAA!" | Noise bandpass 900Hz + sawtooth 230Hz ~0.9s |
| 🙌 siuu | Nhảy ~70px, xoay 360°, tiếp đất giơ 2 tay, 16 mảnh confetti (random theo index) | "SIUUUU!" | Noise highpass 0.18s ("s") → triangle 540→400Hz 1.1s |
| 💬 chat | Bubble trên đầu | — | "pop" sine ngắn |

## 10. ⭐ Thở oxi (tính năng chính)
1. Bấm → chọn bình **trống** gần nhất theo `|tank.y - seat.y|`. Hết bình → toast "Hết bình oxi rồi, đợi chút!".
2. `me.oxygen = { tank, start: Date.now() }` (presence). Hết tổng thời gian → `null`.
3. **Waypoints**: Ghế `(x,y)` → sàn `(x, y+34)` [450ms] → lối đi `(178, y+34)` → `(178, tank.y)` → cạnh bình `(tank.x+58, tank.y)`. Tốc độ **0.16 đơn vị/ms**, mỗi đoạn ≥ 200ms.
4. **Timeline**: đi → thở **6000ms** → về theo đường ngược → ngồi.
5. `oxygenState(seat, tank, elapsed) → { x, y, pose: 'crawl'|'breathe', dir: -1|1, done }` — nội suy tuyến tính, deterministic. `dir` = dấu dx đoạn hiện tại; đoạn dọc: -1 khi đi, +1 khi về.
6. **crawl**: `.figure { transform: rotate(calc(var(--dir) * 78deg)) }`, svg nhún + tay quẫy luân phiên.
7. **breathe**: mặt nạ, thân phập phồng, 4 bong bóng bay lên, ống thở = SVG quadratic path từ van `(tank.x, tank.y-64)` tới miệng `(x, y-36)`. Bình đang dùng phát sáng. Bản thân nghe tiếng "phì" (noise lowpass) khi bắt đầu thở.
8. Render loop: hook `useNow()` dùng requestAnimationFrame, throttle ~30fps.

## 11. Definition of Done
- [ ] `npm run build` pass, không lỗi TS
- [ ] 3 tab local: chọn ghế, tranh ghế, chat, 3 action, thở oxi đều đồng bộ
- [ ] Mobile 375px không scroll ngang; ActionBar: chat 1 hàng, 4 nút 1 hàng
- [ ] Đóng tab → nhân vật biến mất ở tab khác (≤ 6s local)
- [ ] Không dùng localStorage cho dữ liệu cần đồng bộ
- [ ] README tiếng Việt cập nhật (đã có sẵn, giữ nguyên nội dung)

## 12. Roadmap sau demo
Nhiều phòng + lobby · Hype Meter · Dự đoán đội thắng · Ngồi theo phe Xanh/Đỏ · Kiểm duyệt (lọc từ, mute/kick) · Admin đổi link live · Đăng nhập Google.
