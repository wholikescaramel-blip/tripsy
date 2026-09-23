// In-memory store used when Supabase keys are missing. Lives as long as the server process.

import type { AvailabilityRow, ChangeEntry, Member, NudgeLog, Plan, Preferences, Swipe, Trip } from "../types";
import type { NewPlan, NewTripInput, Store } from "./types";

interface DB {
  trips: Trip[];
  members: Member[];
  availability: (AvailabilityRow & { trip_id: string })[];
  preferences: (Preferences & { trip_id: string })[];
  budgets: Map<string, { min: number; max: number }>;
  plans: Plan[];
  swipes: (Swipe & { trip_id: string })[];
  changes: ChangeEntry[];
  nudges: NudgeLog[];
}

const g = globalThis as unknown as { __tripsyDb?: DB };
const db: DB = (g.__tripsyDb ??= {
  trips: [],
  members: [],
  availability: [],
  preferences: [],
  budgets: new Map(),
  plans: [],
  swipes: [],
  changes: [],
  nudges: [],
});

const nowIso = () => new Date().toISOString();
const clone = <T>(x: T): T => structuredClone(x);

/** Per-person max budget; people without one get the average of those who gave one. */
export function effectiveMaxes(memberIds: string[], budgets: Map<string, { max: number }>): Map<string, number> | null {
  const given = memberIds.filter((id) => budgets.has(id)).map((id) => budgets.get(id)!.max);
  if (!given.length) return null;
  const avg = given.reduce((a, b) => a + b, 0) / given.length;
  return new Map(memberIds.map((id) => [id, budgets.get(id)?.max ?? avg]));
}

export const memoryStore: Store = {
  kind: "memory",

  async getBundle(slug) {
    const trip = db.trips.find((t) => t.slug === slug);
    if (!trip) return null;
    const id = trip.id;
    return clone({
      trip,
      members: db.members.filter((m) => m.trip_id === id).sort((a, b) => a.sort_order - b.sort_order),
      availability: db.availability.filter((a) => a.trip_id === id),
      preferences: db.preferences.filter((p) => p.trip_id === id),
      plans: db.plans.filter((p) => p.trip_id === id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      swipes: db.swipes.filter((s) => s.trip_id === id),
      changes: db.changes.filter((c) => c.trip_id === id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      nudges: db.nudges.filter((n) => n.trip_id === id),
    });
  },

  async createTrip(input: NewTripInput) {
    const trip: Trip = {
      id: crypto.randomUUID(),
      slug: input.slug,
      admin_key: input.admin_key,
      name: input.name,
      target_month: input.target_month,
      deadline: input.deadline,
      status: "collecting",
      blend_round: 0,
      agreed_plan_id: null,
      is_demo: input.is_demo,
      created_at: nowIso(),
    };
    db.trips.push(trip);
    input.members.forEach((m, i) =>
      db.members.push({
        id: crypto.randomUUID(),
        trip_id: trip.id,
        name: m.name,
        phone: m.phone,
        is_coordinator: m.is_coordinator,
        sort_order: i,
        has_budget: false,
        submitted_at: null,
        updated_at: null,
        confirmed_at: null,
      }),
    );
    return (await this.getBundle(trip.slug))!;
  },

  async deleteTrip(tripId) {
    const memberIds = new Set(db.members.filter((m) => m.trip_id === tripId).map((m) => m.id));
    for (const id of memberIds) db.budgets.delete(id);
    db.trips = db.trips.filter((t) => t.id !== tripId);
    db.members = db.members.filter((m) => m.trip_id !== tripId);
    db.availability = db.availability.filter((a) => a.trip_id !== tripId);
    db.preferences = db.preferences.filter((a) => a.trip_id !== tripId);
    db.plans = db.plans.filter((a) => a.trip_id !== tripId);
    db.swipes = db.swipes.filter((a) => a.trip_id !== tripId);
    db.changes = db.changes.filter((a) => a.trip_id !== tripId);
    db.nudges = db.nudges.filter((a) => a.trip_id !== tripId);
  },

  async updateTrip(tripId, patch) {
    const t = db.trips.find((x) => x.id === tripId);
    if (t) Object.assign(t, patch);
  },

  async claimTrip(tripId, expect, patch) {
    const t = db.trips.find((x) => x.id === tripId);
    if (!t) return false;
    for (const [k, v] of Object.entries(expect)) if (t[k as keyof Trip] !== v) return false;
    Object.assign(t, patch);
    return true;
  },

  async updateMember(memberId, patch) {
    const m = db.members.find((x) => x.id === memberId);
    if (m) Object.assign(m, patch);
  },

  async replaceAvailability(tripId, memberId, rows) {
    db.availability = db.availability.filter((a) => a.member_id !== memberId);
    db.availability.push(...rows.map((r) => ({ ...r, member_id: memberId, trip_id: tripId })));
  },

  async upsertPreferences(tripId, prefs) {
    db.preferences = db.preferences.filter((p) => p.member_id !== prefs.member_id);
    db.preferences.push({ ...prefs, trip_id: tripId });
  },

  async setBudget(memberId, min, max) {
    db.budgets.set(memberId, { min, max });
    await this.updateMember(memberId, { has_budget: true });
  },

  async budgetFits(tripId, costs) {
    const ids = db.members.filter((m) => m.trip_id === tripId).map((m) => m.id);
    const maxes = effectiveMaxes(ids, db.budgets);
    return costs.map((c) => Object.fromEntries(ids.map((id) => [id, maxes ? c <= maxes.get(id)! : true])));
  },

  async budgetCeiling(tripId) {
    const ids = db.members.filter((m) => m.trip_id === tripId).map((m) => m.id);
    const maxes = effectiveMaxes(ids, db.budgets);
    return maxes ? Math.min(...maxes.values()) : null;
  },

  async insertPlans(plans: NewPlan[]) {
    const out = plans.map((p, i) => ({
      ...p,
      id: crypto.randomUUID(),
      // Keep insertion order stable even within the same millisecond.
      created_at: new Date(Date.now() + i).toISOString(),
    }));
    db.plans.push(...out);
    return clone(out);
  },

  async updatePlan(planId, patch) {
    const p = db.plans.find((x) => x.id === planId);
    if (p) Object.assign(p, patch);
  },

  async upsertSwipe(tripId, swipe) {
    db.swipes = db.swipes.filter((s) => !(s.plan_id === swipe.plan_id && s.member_id === swipe.member_id));
    db.swipes.push({ ...swipe, trip_id: tripId, updated_at: nowIso() });
  },

  async addChange(entry) {
    db.changes.push({ ...entry, id: crypto.randomUUID(), created_at: nowIso() });
  },

  async logNudge(n) {
    db.nudges.push({ ...n, sent_at: nowIso() });
  },
};
