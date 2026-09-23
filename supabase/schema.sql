-- Tripsy schema. Paste this whole file into Supabase → SQL Editor → Run (once).
-- Safe to re-run: it drops and recreates everything (all data is lost).

create extension if not exists pgcrypto;

drop table if exists nudge_log, changes, swipes, plans, member_budgets, preferences, availability, members, trips cascade;
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
create index on members(trip_id);

create table availability (
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  day date not null,
  status text not null check (status in ('free', 'busy', 'maybe')),
  maybe_known_by date,
  primary key (member_id, day)
);
create index on availability(trip_id);

create table preferences (
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid primary key references members(id) on delete cascade,
  home_city text not null default '',
  vibes text[] not null default '{}',
  activities text[] not null default '{}',
  vetoes text[] not null default '{}',
  veto_notes text not null default '',
  wishes text not null default ''
);
create index on preferences(trip_id);

-- Private. No read policy at all: only the security-definer functions below touch it.
create table member_budgets (
  member_id uuid primary key references members(id) on delete cascade,
  budget_min int not null,
  budget_max int not null
);

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
create index on plans(trip_id);

create table swipes (
  trip_id uuid not null references trips(id) on delete cascade,
  plan_id uuid not null references plans(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  decision text not null check (decision in ('accept', 'decline')),
  reason text,
  updated_at timestamptz not null default now(),
  primary key (plan_id, member_id)
);
create index on swipes(trip_id);

create table changes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid references members(id) on delete set null,
  kind text not null,
  summary text not null,
  created_at timestamptz not null default clock_timestamp()
);
create index on changes(trip_id);

create table nudge_log (
  trip_id uuid not null references trips(id) on delete cascade,
  member_id uuid not null references members(id) on delete cascade,
  nudge_kind text not null,
  sent_at timestamptz not null default now(),
  primary key (member_id, nudge_kind)
);

-- Row level security: the app only has the public anon key, so everything is open
-- to it EXCEPT member_budgets, which has RLS on and no policies (= nobody can read it).
alter table trips enable row level security;
alter table members enable row level security;
alter table availability enable row level security;
alter table preferences enable row level security;
alter table member_budgets enable row level security;
alter table plans enable row level security;
alter table swipes enable row level security;
alter table changes enable row level security;
alter table nudge_log enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trips','members','availability','preferences','plans','swipes','changes','nudge_log'] loop
    execute format('create policy "anon all %1$s" on %1$I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
revoke all on member_budgets from anon, authenticated;

-- Write a budget (never readable back).
create function set_budget(p_member uuid, p_min int, p_max int) returns void
language sql security definer set search_path = public as $$
  insert into member_budgets(member_id, budget_min, budget_max)
  values (p_member, p_min, p_max)
  on conflict (member_id) do update set budget_min = excluded.budget_min, budget_max = excluded.budget_max;
  update members set has_budget = true where id = p_member;
$$;

-- For each cost, does it fit each member? Members without a budget get the average of the others.
create function budget_fits(p_trip uuid, p_costs int[])
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
create function budget_ceiling(p_trip uuid) returns int
language sql security definer set search_path = public as $$
  with m as (
    select b.budget_max from members mem
    left join member_budgets b on b.member_id = mem.id
    where mem.trip_id = p_trip
  )
  select min(coalesce(budget_max, (select avg(budget_max) from m)))::int from m;
$$;

grant execute on function set_budget(uuid, int, int) to anon, authenticated;
grant execute on function budget_fits(uuid, int[]) to anon, authenticated;
grant execute on function budget_ceiling(uuid) to anon, authenticated;
