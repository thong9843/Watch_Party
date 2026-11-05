-- ============================================================================
-- SUPABASE SCHEMA + RLS FOR WATCH PARTY 3D (V3-O3 SECURITY SPEC)
-- ============================================================================

-- 1. RATE LIMITS TABLE & ATOMIC FUNCTION
-- Used by Next.js Server API for distributed atomic rate limiting
create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 1,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;

-- Rate limits accessed exclusively via Service Role
drop policy if exists "allow_service_role_rate_limits" on public.rate_limits;
create policy "allow_service_role_rate_limits"
  on public.rate_limits for all
  using (auth.role() = 'service_role');

-- Atomic Rate Limit Function (Security Definer)
create or replace function public.check_rate_limit(
  p_key text,
  p_limit int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_rec record;
begin
  select count, reset_at into v_rec
  from public.rate_limits
  where key = p_key
  for update;

  if not found or v_rec.reset_at <= v_now then
    insert into public.rate_limits (key, count, reset_at)
    values (p_key, 1, v_now + (p_window_seconds || ' seconds')::interval)
    on conflict (key) do update
      set count = 1,
          reset_at = v_now + (p_window_seconds || ' seconds')::interval;
    return true;
  end if;

  if v_rec.count < p_limit then
    update public.rate_limits
    set count = count + 1
    where key = p_key;
    return true;
  end if;

  return false;
end;
$$;


-- 2. ROOM CONFIG TABLE
-- Authoritative persistent room state (video, cheering banners, lighting mode)
create table if not exists public.room_config (
  room_id text primary key,
  video_url text not null,
  top_banner text not null default '🔥 CHÁY LÊN ANH EM T1 FIGHTING! ★ GEN.G VÔ ĐỊCH! ★ BLG BÙNG NỔ! ★ CKTG 2026',
  bottom_banner text not null default '⚡ SIUUUUU! • THỞ OXI CẤP CỨU! • GÁY BẨN LÊN! • CUỒNG NHIỆT (HÒ HÉT ĐI NÀO) ⚡',
  cinema_lights text not null default 'on',
  updated_at timestamptz not null default now(),
  updated_by text
);

-- Seed default room configurations
insert into public.room_config (room_id, video_url)
values 
  ('room-cktg-1', 'jfKfPfyJRdk'),
  ('room-cktg-2', 'jfKfPfyJRdk'),
  ('room-cktg-3', 'jfKfPfyJRdk'),
  ('room-cktg-4', 'jfKfPfyJRdk')
on conflict (room_id) do nothing;

alter table public.room_config enable row level security;

-- Public can SELECT room config (anon read-only)
drop policy if exists "allow_public_read_room_config" on public.room_config;
create policy "allow_public_read_room_config"
  on public.room_config for select
  using (true);

-- Only Server API with SERVICE_ROLE key can insert/update/delete room config
drop policy if exists "allow_service_role_write_room_config" on public.room_config;
create policy "allow_service_role_write_room_config"
  on public.room_config for all
  using (auth.role() = 'service_role');


-- 3. CHAT LOG TABLE (Preserved for 7 days)
create table if not exists public.chat_log (
  id bigint generated always as identity primary key,
  room_id text not null,
  sender_id text not null,
  sender_name text not null,
  message varchar(60) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_log_room_created on public.chat_log (room_id, created_at desc);

alter table public.chat_log enable row level security;

-- Public can SELECT chat history (anon read-only)
drop policy if exists "allow_public_read_chat" on public.chat_log;
create policy "allow_public_read_chat"
  on public.chat_log for select
  using (true);

-- Drop legacy anon insert policy if exists (Chat is written via Server API only)
drop policy if exists "allow_public_insert_chat" on public.chat_log;

-- Only Server API with SERVICE_ROLE key can insert chat messages
drop policy if exists "allow_service_role_write_chat" on public.chat_log;
create policy "allow_service_role_write_chat"
  on public.chat_log for all
  using (auth.role() = 'service_role');

-- Cleanup older than 7 days
create or replace function public.cleanup_old_chat_logs()
returns void
language sql
security definer
as $$
  delete from public.chat_log where created_at < now() - interval '7 days';
$$;


-- 4. REPORTS TABLE (Player moderation & reporting)
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id text not null,
  reported_id text not null,
  reason text not null,
  room_id text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- Reports are inserted and read exclusively through Server API (service_role)
drop policy if exists "allow_public_insert_report" on public.reports;
drop policy if exists "allow_service_role_reports" on public.reports;
create policy "allow_service_role_reports"
  on public.reports for all
  using (auth.role() = 'service_role');


-- 5. VIDEO SUGGESTIONS TABLE (Audience proposals)
create table if not exists public.video_suggestions (
  id uuid primary key default gen_random_uuid(),
  room_id text not null,
  video_url text not null,
  title text,
  suggested_by text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create index if not exists idx_suggestions_room_created on public.video_suggestions (room_id, created_at desc);

alter table public.video_suggestions enable row level security;

-- Suggestions handled exclusively via Server API (service_role)
drop policy if exists "allow_service_role_suggestions" on public.video_suggestions;
create policy "allow_service_role_suggestions"
  on public.video_suggestions for all
  using (auth.role() = 'service_role');


-- 6. ENABLE REALTIME PUBLICATION FOR room_config
-- Broadcasts changes to postgres_changes subscribers
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'room_config'
  ) then
    alter publication supabase_realtime add table public.room_config;
  end if;
exception
  when others then
    -- Ignore if publication does not exist in local/mock environments
    null;
end;
$$;
