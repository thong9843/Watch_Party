-- ============================================================================
-- SUPABASE SCHEMA + RLS FOR WATCH PARTY 3D (V3 O3)
-- ============================================================================

-- 1. ROOM CONFIG TABLE
-- Stores persistent room state (video, cheering banners, lighting mode)
create table if not exists public.room_config (
  room_id text primary key,
  video_url text not null,
  top_banner text not null default '🔥 CHÁY LÊN ANH EM T1 FIGHTING! ★ GEN.G VÔ ĐỊCH! ★ BLG BÙNG NỔ! ★ CKTG 2026',
  bottom_banner text not null default '⚡ SIUUUUU! • THỞ OXI CẤP CỨU! • GÁY BẨN LÊN! • CUỒNG NHIỆT (HÒ HÉT ĐI NÀO) ⚡',
  cinema_lights text not null default 'on',
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed default room configs
insert into public.room_config (room_id, video_url)
values 
  ('room-cktg-1', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ('room-cktg-2', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ('room-cktg-3', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'),
  ('room-cktg-4', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ')
on conflict (room_id) do nothing;

-- Enable Row Level Security (RLS) for room_config
alter table public.room_config enable row level security;

-- Public can read all room configurations
create policy "allow_public_read_room_config"
  on public.room_config for select
  using (true);

-- Only Server API with SERVICE_ROLE key can modify room configuration
create policy "allow_service_role_write_room_config"
  on public.room_config for all
  using (auth.role() = 'service_role');


-- 2. CHAT LOG TABLE (Preserved for 7 days)
create table if not exists public.chat_log (
  id bigint generated always as identity primary key,
  room_id text not null,
  sender_id text not null,
  sender_name text not null,
  message varchar(60) not null,
  created_at timestamptz not null default now()
);

-- Index for room query
create index if not exists idx_chat_log_room_created on public.chat_log (room_id, created_at desc);

-- Enable RLS for chat_log
alter table public.chat_log enable row level security;

create policy "allow_public_read_chat"
  on public.chat_log for select
  using (true);

create policy "allow_public_insert_chat"
  on public.chat_log for insert
  with check (length(message) <= 60);

-- Automated retention cleanup function (keeps last 7 days)
create or replace function public.cleanup_old_chat_logs()
returns void
language sql
security definer
as $$
  delete from public.chat_log where created_at < now() - interval '7 days';
$$;

-- Note for Supabase pg_cron:
-- If pg_cron is enabled in Database Extensions, schedule daily execution:
-- select cron.schedule('daily-chat-cleanup', '0 3 * * *', 'select public.cleanup_old_chat_logs()');


-- 3. REPORTS TABLE (Player moderation & reporting)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null,
  reported_id text not null,
  reason text not null,
  room_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- Enable RLS for reports
alter table public.reports enable row level security;

-- Public can submit reports
create policy "allow_public_insert_report"
  on public.reports for insert
  with check (true);

-- Only admin (service role) can view submitted reports
create policy "allow_service_role_read_report"
  on public.reports for select
  using (auth.role() = 'service_role');

