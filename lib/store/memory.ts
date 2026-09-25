// In-memory store used when Supabase keys are missing (local dev only). Lives as long as the server process.

import type { ChangeEntry, DateOption, DateVote, Idea, IdeaSwipe, Member, NudgeLog, Plan, Preferences, Swipe, Trip } from "../types";
import type { NewPlan, NewTripInput, Store } from "./types";

type WithTrip<T> = T & { trip_id: string };

interface DB {
  trips: Trip[];
  members: Member[];
  dateOptions: DateOption[];
  dateVotes: WithTrip<DateVote>[];
  ideas: Idea[];
  ideaSwipes: WithTrip<IdeaSwipe>[];
  preferences: WithTrip<Preferences>[];
  budgets: Map<string, { min: number; max: number }>;
  plans: Plan[];
  swipes: WithTrip<Swipe>[];
  changes: ChangeEntry[];
  nudges: NudgeLog[];
}

const empty = (): DB => ({
  trips: [],
  members: [],
  dateOptions: [],
  dateVotes: [],
  ideas: [],
  ideaSwipes: [],
  preferences: [],
  budgets: new Map(),
  plans: [],
  swipes: [],
  changes: [],
  nudges: [],
});

const g = globalThis as unknown as { __tripsyDb2?: DB };
const db: DB = (g.__tripsyDb2 ??= empty());

const nowIso = () => new Date().toISOString();
const clone = <T>(x: T): T => structuredClone(x);
const stamp = (i = 0) => new Date(Date.now() + i).toISOString();

/** Per-person max budget; people without one get the average of those who gave one. */
export function effectiveMaxes(memberIds: string[], budgets: Map<string, { max: number }>): Map<string, number> | null {
  const given = memberIds.filter((id) => budgets.has(id)).map((id) => budgets.get(id)!.max);
  if (!given.length) return null;
  const avg = given.reduce((a, b) => a + b, 0) / given.length;
  return new Map(memberIds.map((id) => [id, budgets.get(id)?.max ?? avg]));
}

function newMember(tripId: string, m: { name: string; phone: string; is_coordinator?: boolean }, order: number): Member {
  return {
    id: crypto.randomUUID(),
    trip_id: tripId,
    name: m.name,
    phone: m.phone,
    is_coordinator: Boolean(m.is_coordinator),
    sort_order: order,
    has_budget: false,
    submitted_at: null,
    updated_at: null,
    confirmed_at: null,
  };
}

const byTrip = <T extends { trip_id: string }>(rows: T[], id: string) => rows.filter((r) => r.trip_id === id);

export const memoryStore: Store = {
  kind: "memory",

  async getBundle(slug) {
    const trip = db.trips.find((t) => t.slug === slug);
    if (!trip) return null;
    const id = trip.id;
    return clone({
      trip,
      members: byTrip(db.members, id).sort((a, b) => a.sort_order - b.sort_order),
      dateOptions: byTrip(db.dateOptions, id).sort((a, b) => a.start_date.localeCompare(b.start_date)),
      dateVotes: byTrip(db.dateVotes, id),
      ideas: byTrip(db.ideas, id).sort((a, b) => a.sort_order - b.sort_order),
      ideaSwipes: byTrip(db.ideaSwipes, id),
      preferences: byTrip(db.preferences, id),
      plans: byTrip(db.plans, id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
      swipes: byTrip(db.swipes, id),
      changes: byTrip(db.changes, id).sort((a, b) => b.created_at.localeCompare(a.created_at)),
      nudges: byTrip(db.nudges, id),
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
    input.members.forEach((m, i) => db.members.push(newMember(trip.id, m, i)));
    return (await this.getBundle(trip.slug))!;
  },

  async deleteTrip(tripId) {
    for (const m of byTrip(db.members, tripId)) db.budgets.delete(m.id);
    const keep = <T extends { trip_id: string }>(rows: T[]) => rows.filter((r) => r.trip_id !== tripId);
    db.trips = db.trips.filter((t) => t.id !== tripId);
    db.members = keep(db.members);
    db.dateOptions = keep(db.dateOptions);
    db.dateVotes = keep(db.dateVotes);
    db.ideas = keep(db.ideas);
    db.ideaSwipes = keep(db.ideaSwipes);
    db.preferences = keep(db.preferences);
    db.plans = keep(db.plans);
    db.swipes = keep(db.swipes);
    db.changes = keep(db.changes);
    db.nudges = keep(db.nudges);
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

  async addMember(tripId, m) {
    const member = newMember(tripId, m, byTrip(db.members, tripId).length);
    db.members.push(member);
    return clone(member);
  },

  async removeMember(memberId) {
    const drop = <T extends { member_id: string }>(rows: T[]) => rows.filter((r) => r.member_id !== memberId);
    db.members = db.members.filter((m) => m.id !== memberId);
    db.dateVotes = drop(db.dateVotes);
    db.ideaSwipes = drop(db.ideaSwipes);
    db.preferences = drop(db.preferences);
    db.swipes = drop(db.swipes);
    db.nudges = drop(db.nudges);
    db.budgets.delete(memberId);
  },

  async updateMember(memberId, patch) {
    const m = db.members.find((x) => x.id === memberId);
    if (m) Object.assign(m, patch);
  },

  async addDateOptions(tripId, options) {
    options.forEach((o, i) => db.dateOptions.push({ ...o, id: crypto.randomUUID(), trip_id: tripId, created_at: stamp(i) }));
  },

  async removeDateOption(optionId) {
    db.dateOptions = db.dateOptions.filter((o) => o.id !== optionId);
    db.dateVotes = db.dateVotes.filter((v) => v.option_id !== optionId);
  },

  async upsertDateVote(tripId, vote) {
    db.dateVotes = db.dateVotes.filter((v) => !(v.option_id === vote.option_id && v.member_id === vote.member_id));
    db.dateVotes.push({ ...vote, trip_id: tripId, updated_at: nowIso() });
  },

  async insertIdeas(tripId, ideas) {
    const start = byTrip(db.ideas, tripId).length;
    ideas.forEach((idea, i) => db.ideas.push({ ...idea, id: crypto.randomUUID(), trip_id: tripId, sort_order: start + i }));
  },

  async upsertIdeaSwipe(tripId, swipe) {
    db.ideaSwipes = db.ideaSwipes.filter((s) => !(s.idea_id === swipe.idea_id && s.member_id === swipe.member_id));
    db.ideaSwipes.push({ ...swipe, trip_id: tripId });
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
    const ids = byTrip(db.members, tripId).map((m) => m.id);
    const maxes = effectiveMaxes(ids, db.budgets);
    return costs.map((c) => Object.fromEntries(ids.map((id) => [id, maxes ? c <= maxes.get(id)! : true])));
  },

  async budgetCeiling(tripId) {
    const maxes = effectiveMaxes(byTrip(db.members, tripId).map((m) => m.id), db.budgets);
    return maxes ? Math.min(...maxes.values()) : null;
  },

  async insertPlans(plans: NewPlan[]) {
    const out = plans.map((p, i) => ({ ...p, id: crypto.randomUUID(), created_at: stamp(i) }));
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
    db.nudges = db.nudges.filter((x) => !(x.member_id === n.member_id && x.nudge_kind === n.nudge_kind));
    db.nudges.push({ ...n, sent_at: nowIso() });
  },
};
