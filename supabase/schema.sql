-- Tripsy schema. Paste this whole file into Supabase → SQL Editor → Run (once).
-- Safe to re-run: it drops and recreates everything (all data is lost).
-- Supabase will warn about "destructive operations" — that's the DROP below, fine on a new project.
-- Just click Run. Don't pick "Run and enable RLS": RLS is already enabled below, and that option rewrites the SQL.

create extension if not exists pgcrypto;

drop table if exists nudge_log, changes, swipes, plans, member_budgets, preferences, idea_swipes, ideas, date_votes, date_options, availability, members, trips cascade;
drop function if exists set_budget(uuid, int, int);
drop function if exists budget_fits(uuid, int[]);
drop function if exists budget_ceiling(uuid);

create table trips (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  admin_key text not null,
  name text not null,
  target_month date not null,
  deadline timestamptz not null,
  status text not null default 'collecting'
    check (status in ('collecting', 'voting', 'agreed', 'confirmed', 'stuck')),
  blend_round int not null default 0,
  agreed_plan_id uuid,
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
alter table trips enable row level security;
grant select, insert, update, delete on trips to anon, authenticated, service_role;
create policy "public access" on trips for all to anon, authenticated using (true) with check (true);

create table members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  name text not null,
  phone text not null,
  is_coordinator boolean not null default false,
  sort_order int not null default 0,
  has_budget boolean not null default false,
  submitted_at timestamptz,
  updated_at timestamptz,
  confirmed_at timestamptz
);
alter table members enable row level security;
grant select, insert, update, delete on members to anon, authenticated, service_role;
create policy "public access" on members for all to anon, authenticated using (true) with check (true);
create index on members(trip_id);

create table date_options (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  added_by text not null default 'app' check (added_by in ('app', 'coordinator')),
  created_at timestamptz not null default clock_timestamp()
);
alter table date_options enable row level security;
grant select, insert, update, delete on date_options to anon, authenticated, service_role;
create policy "public access" on date_options for all to anon, authenticated using (true) with check (true);
create index on date_options(trip_id);

create table date_votes (
  trip_id uuid not null references trips(id) on delete cascade,
  option_id uuid not null references date_options(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  vote text not null check (vote in ('yes', 'no', 'maybe')),
  known_by date,
  updated_at timestamptz not null default now()
);
alter table date_votes add primary key (option_id, member_id);
alter table date_votes enable row level security;
grant select, insert, update, delete on date_votes to anon, authenticated, service_role;
create policy "public access" on date_votes for all to anon, authenticated using (true) with check (true);
create index on date_votes(trip_id);

create table ideas (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  destination text not null,
  region text not null default '',
  pitch text not null default '',
  highlights text[] not null default '{}',
  emoji text not null default '🧭',
  cost_estimate int not null default 0,
  tags text[] not null default '{}',
  sort_order int not null default 0
);
alter table ideas enable row level security;
grant select, insert, update, delete on ideas to anon, authenticated, service_role;
create policy "public access" on ideas for all to anon, authenticated using (true) with check (true);
create index on ideas(trip_id);

create table idea_swipes (
  trip_id uuid not null references trips(id) on delete cascade,
  idea_id uuid not null references ideas(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  liked boolean not null
);
alter table idea_swipes add primary key (idea_id, member_id);
alter table idea_swipes enable row level security;
grant select, insert, update, delete on idea_swipes to anon, authenticated, service_role;
create policy "public access" on idea_swipes for all to anon, authenticated using (true) with check (true);
create index on idea_swipes(trip_id);

create table preferences (
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid primary key references members(id) on delete cascade,
  home_city text not null default '',
  vetoes text[] not null default '{}',
  veto_notes text not null default ''
);
alter table preferences enable row level security;
grant select, insert, update, delete on preferences to anon, authenticated, service_role;
create policy "public access" on preferences for all to anon, authenticated using (true) with check (true);
create index on preferences(trip_id);

-- Private. No read policy at all: only the security-definer functions below touch it.
create table member_budgets (
  member_id uuid primary key references members(id) on delete cascade,
  budget_min int not null,
  budget_max int not null
);
alter table member_budgets enable row level security;
grant all on member_budgets to service_role; -- the public key gets NO access to budgets

create table plans (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  round int not null default 0,
  kind text not null check (kind in ('initial', 'blend', 'replacement')),
  source_plan_ids uuid[] not null default '{}',
  replaces_plan_id uuid,
  destination text not null,
  region text not null default '',
  summary text not null default '',
  start_date date not null,
  end_date date not null,
  activities jsonb not null default '[]',
  travel text not null default '',
  stay text not null default '',
  cost_per_person int not null,
  fit_notes jsonb not null default '{}',
  tags text[] not null default '{}',
  status text not null default 'active'
    check (status in ('active', 'broken', 'rejected', 'superseded', 'agreed')),
  status_reason text,
  created_at timestamptz not null default clock_timestamp()
);
alter table plans enable row level security;
grant select, insert, update, delete on plans to anon, authenticated, service_role;
create policy "public access" on plans for all to anon, authenticated using (true) with check (true);
create index on plans(trip_id);

create table swipes (
  trip_id uuid not null references trips(id) on delete cascade,
  plan_id uuid not null references plans(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  decision text not null check (decision in ('accept', 'decline')),
  reason text,
  updated_at timestamptz not null default now()
);
alter table swipes add primary key (plan_id, member_id);
alter table swipes enable row level security;
grant select, insert, update, delete on swipes to anon, authenticated, service_role;
create policy "public access" on swipes for all to anon, authenticated using (true) with check (true);
create index on swipes(trip_id);

create table changes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  kind text not null,
  summary text not null,
  created_at timestamptz not null default clock_timestamp()
);
alter table changes enable row level security;
grant select, insert, update, delete on changes to anon, authenticated, service_role;
create policy "public access" on changes for all to anon, authenticated using (true) with check (true);
create index on changes(trip_id);

create table nudge_log (
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  nudge_kind text not null,
  sent_at timestamptz not null default now()
);
alter table nudge_log add primary key (member_id, nudge_kind);
alter table nudge_log enable row level security;
grant select, insert, update, delete on nudge_log to anon, authenticated, service_role;
create policy "public access" on nudge_log for all to anon, authenticated using (true) with check (true);

-- ============================================================================
-- ACCESS: who may use what. Also in supabase/fix-permissions.sql (safe to re-run, keeps data).
-- The app only uses the public (publishable/anon) key. It can read and write everything
-- EXCEPT member_budgets; budgets are only reachable through the three functions below.
-- ============================================================================

grant usage on schema public to anon, authenticated, service_role;

do $$
declare t text;
begin
  foreach t in array array['trips','members','date_options','date_votes','ideas','idea_swipes','preferences','plans','swipes','changes','nudge_log'] loop
    if to_regclass('public.' || t) is null then
      raise warning 'Table % is missing — run supabase/schema.sql to create all tables', t;
      continue;
    end if;
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated, service_role', t);
    execute format('drop policy if exists "public access" on public.%I', t);
    execute format('drop policy if exists "anon all %1$s" on public.%1$I', t);
    execute format('create policy "public access" on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

alter table public.member_budgets enable row level security;
revoke all on public.member_budgets from anon, authenticated;
grant all on public.member_budgets to service_role;

-- Write a budget (never readable back).
create or replace function public.set_budget(p_member uuid, p_min int, p_max int) returns void
language sql security definer set search_path = public as $$
  insert into member_budgets(member_id, budget_min, budget_max)
  values (p_member, p_min, p_max)
  on conflict (member_id) do update set budget_min = excluded.budget_min, budget_max = excluded.budget_max;
  update members set has_budget = true where id = p_member;
$$;

-- For each cost, does it fit each member? Members without a budget get the average of the others.
create or replace function public.budget_fits(p_trip uuid, p_costs int[])
returns table(cost_index int, member_id uuid, fits boolean)
language sql security definer set search_path = public as $$
  with m as (
    select mem.id, b.budget_max from members mem
    left join member_budgets b on b.member_id = mem.id
    where mem.trip_id = p_trip
  ), avg_max as (select avg(budget_max) as v from m)
  select c.idx::int, m.id,
         case when (select v from avg_max) is null then true
              else c.cost <= coalesce(m.budget_max, (select v from avg_max)) end
  from unnest(p_costs) with ordinality as c(cost, idx)
  cross join m;
$$;

-- Lowest effective max budget in the group (no names attached) — used to steer Gemini.
create or replace function public.budget_ceiling(p_trip uuid) returns int
language sql security definer set search_path = public as $$
  with m as (
    select b.budget_max from members mem
    left join member_budgets b on b.member_id = mem.id
    where mem.trip_id = p_trip
  )
  select min(coalesce(budget_max, (select avg(budget_max) from m)))::int from m;
$$;

grant execute on function public.set_budget(uuid, int, int) to anon, authenticated, service_role;
grant execute on function public.budget_fits(uuid, int[]) to anon, authenticated, service_role;
grant execute on function public.budget_ceiling(uuid) to anon, authenticated, service_role;

-- Make the API pick up the new tables and permissions straight away.
notify pgrst, 'reload schema';
