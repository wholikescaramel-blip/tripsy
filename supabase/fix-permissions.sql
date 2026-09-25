-- Tripsy: fix "permission denied for table …".
-- Safe to run any time: it does NOT delete anything, it only (re)applies permissions and functions.
-- Supabase → SQL Editor → New query → paste this whole file → Run.

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
