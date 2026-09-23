// Supabase store. Uses only the public anon key; budgets go through RPC functions (see supabase/schema.sql).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Plan, TripBundle } from "../types";
import type { NewPlan, NewTripInput, Store } from "./types";

let client: SupabaseClient | null = null;
function sb(): SupabaseClient {
  client ??= createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false },
  });
  return client;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(`Supabase: ${res.error.message}`);
  return res.data;
}

const nowIso = () => new Date().toISOString();

export const supabaseStore: Store = {
  kind: "supabase",

  async getBundle(slug) {
    const trip = check(await sb().from("trips").select("*").eq("slug", slug).maybeSingle());
    if (!trip) return null;
    const id = trip.id as string;
    const q = (table: string) => sb().from(table).select("*").eq("trip_id", id);
    const [members, availability, preferences, plans, swipes, changes, nudges] = await Promise.all([
      q("members").order("sort_order"),
      q("availability"),
      q("preferences"),
      q("plans").order("created_at"),
      q("swipes"),
      q("changes").order("created_at", { ascending: false }).limit(100),
      q("nudge_log"),
    ]);
    return {
      trip,
      members: check(members),
      availability: check(availability),
      preferences: check(preferences),
      plans: check(plans),
      swipes: check(swipes),
      changes: check(changes),
      nudges: check(nudges),
    } as TripBundle;
  },

  async createTrip(input: NewTripInput) {
    const { members, ...trip } = input;
    const row = check(await sb().from("trips").insert(trip).select().single());
    check(
      await sb()
        .from("members")
        .insert(members.map((m, i) => ({ ...m, trip_id: row.id, sort_order: i }))),
    );
    return (await this.getBundle(input.slug))!;
  },

  async deleteTrip(tripId) {
    check(await sb().from("trips").delete().eq("id", tripId));
  },

  async updateTrip(tripId, patch) {
    check(await sb().from("trips").update(patch).eq("id", tripId));
  },

  async claimTrip(tripId, expect, patch) {
    let q = sb().from("trips").update(patch).eq("id", tripId);
    for (const [k, v] of Object.entries(expect)) q = v === null ? q.is(k, null) : q.eq(k, v as string | number);
    const rows = check(await q.select("id"));
    return (rows?.length ?? 0) > 0;
  },

  async updateMember(memberId, patch) {
    check(await sb().from("members").update(patch).eq("id", memberId));
  },

  async replaceAvailability(tripId, memberId, rows) {
    check(await sb().from("availability").delete().eq("member_id", memberId));
    if (rows.length) {
      check(await sb().from("availability").insert(rows.map((r) => ({ ...r, member_id: memberId, trip_id: tripId }))));
    }
  },

  async upsertPreferences(tripId, prefs) {
    check(await sb().from("preferences").upsert({ ...prefs, trip_id: tripId }));
  },

  async setBudget(memberId, min, max) {
    check(await sb().rpc("set_budget", { p_member: memberId, p_min: Math.round(min), p_max: Math.round(max) }));
  },

  async budgetFits(tripId, costs) {
    if (!costs.length) return [];
    const rows = check(
      await sb().rpc("budget_fits", { p_trip: tripId, p_costs: costs.map((c) => Math.round(c)) }),
    ) as { cost_index: number; member_id: string; fits: boolean }[];
    const out: Record<string, boolean>[] = costs.map(() => ({}));
    for (const r of rows) out[r.cost_index - 1][r.member_id] = r.fits;
    return out;
  },

  async budgetCeiling(tripId) {
    return check(await sb().rpc("budget_ceiling", { p_trip: tripId })) as number | null;
  },

  async insertPlans(plans: NewPlan[]) {
    if (!plans.length) return [];
    const out: Plan[] = [];
    // One by one so created_at keeps the insertion order.
    for (const p of plans) out.push(check(await sb().from("plans").insert(p).select().single()) as Plan);
    return out;
  },

  async updatePlan(planId, patch) {
    check(await sb().from("plans").update(patch).eq("id", planId));
  },

  async upsertSwipe(tripId, swipe) {
    check(await sb().from("swipes").upsert({ ...swipe, trip_id: tripId, updated_at: nowIso() }));
  },

  async addChange(entry) {
    check(await sb().from("changes").insert(entry));
  },

  async logNudge(n) {
    check(await sb().from("nudge_log").upsert({ ...n, sent_at: nowIso() }));
  },
};
