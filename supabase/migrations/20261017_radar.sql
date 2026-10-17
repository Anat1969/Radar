-- RADAR-GH schema in the shared Supabase project cultura-GH (every object prefixed radar_).
-- Applied through the Supabase MCP tools; kept here as the source of truth.
create extension if not exists pg_net;
create extension if not exists pg_cron;

create table public.radar_topics (
  id uuid primary key default gen_random_uuid(),
  keyword text not null check (char_length(keyword) between 2 and 80),
  color text not null default '#F5A623',
  is_active boolean not null default true,
  status text not null default 'pending' check (status in ('pending','active','error')),
  last_scanned_at timestamptz,
  last_error text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.radar_articles (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.radar_topics(id) on delete cascade,
  title text not null,
  source text,
  url text not null,
  description text,
  published_at timestamptz,
  saved boolean not null default false,
  relevant boolean, -- set by Claude after each scan; false = off-topic search hit
  created_at timestamptz not null default now(),
  unique (topic_id, url)
);
create index radar_articles_topic_pub on public.radar_articles(topic_id, published_at desc);

create table public.radar_digests (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.radar_topics(id) on delete cascade,
  date date not null,
  headline text, summary text,
  themes jsonb not null default '[]', entities jsonb not null default '[]',
  tone text, signal int, whats_new text,
  article_count int not null default 0,
  created_at timestamptz not null default now(),
  unique (topic_id, date)
);

create table public.radar_settings (
  id int primary key default 1 check (id = 1),
  scan_hour int not null default 7 check (scan_hour between 0 and 23),
  auto_scan boolean not null default true,
  last_auto_scan date,
  blocked_sources text[] not null default array['vietnam.vn'],
  updated_at timestamptz not null default now()
);
insert into public.radar_settings (id) values (1);

create table public.radar_scan_log (
  id bigserial primary key,
  topic_id uuid references public.radar_topics(id) on delete set null,
  kind text not null default 'manual',
  ok boolean not null default true,
  new_articles int not null default 0,
  created_at timestamptz not null default now()
);

-- No login (Anat's choice): open read; anon writes limited to specific columns.
alter table public.radar_topics enable row level security;
alter table public.radar_articles enable row level security;
alter table public.radar_digests enable row level security;
alter table public.radar_settings enable row level security;
alter table public.radar_scan_log enable row level security;
create policy radar_topics_read on public.radar_topics for select using (true);
create policy radar_topics_insert on public.radar_topics for insert with check (true);
create policy radar_topics_update on public.radar_topics for update using (true) with check (true);
create policy radar_topics_delete on public.radar_topics for delete using (true);
create policy radar_articles_read on public.radar_articles for select using (true);
create policy radar_articles_update on public.radar_articles for update using (true) with check (true);
create policy radar_digests_read on public.radar_digests for select using (true);
create policy radar_settings_read on public.radar_settings for select using (true);
create policy radar_settings_update on public.radar_settings for update using (true) with check (true);
create policy radar_scan_log_read on public.radar_scan_log for select using (true);
revoke update on public.radar_articles from anon, authenticated;
grant update (saved) on public.radar_articles to anon, authenticated;
revoke update on public.radar_settings from anon, authenticated;
grant update (scan_hour, auto_scan, blocked_sources, updated_at) on public.radar_settings to anon, authenticated;
revoke update on public.radar_topics from anon, authenticated;
grant update (keyword, color, is_active, sort_order) on public.radar_topics to anon, authenticated;

create or replace function public.radar_enforce_max_topics()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.is_active and (select count(*) from public.radar_topics where is_active and id <> new.id) >= 8 then
    raise exception 'radar: up to 8 active topics';
  end if;
  return new;
end $$;
create trigger radar_max_topics before insert or update on public.radar_topics
  for each row execute function public.radar_enforce_max_topics();

-- Hourly; the function scans only at radar_settings.scan_hour (Israel time).
select cron.schedule('radar-auto-scan', '7 * * * *', $$select net.http_post(url:='https://ktqmwpbzcnzkhjskqisy.supabase.co/functions/v1/radar-scan', body:='{"mode":"auto"}'::jsonb, headers:='{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds:=150000)$$);
