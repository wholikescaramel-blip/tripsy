// Turns a TripBundle into what the pages render. Pure, serialisable, and never contains budgets.
import "server-only";

import { checkPlan } from "./rules";
import { datesFor, isDeadlinePassed, readyToPlan } from "./service";
import type { DatesResult } from "./dates";
import { istDay } from "./time";
import type { ChangeEntry, Plan, TripBundle, TripStatus } from "./types";

export interface MemberView {
  id: string;
  name: string;
  isCoordinator: boolean;
  submitted: boolean;
  assumed: boolean;
  updatedAt: string | null;
  confirmed: boolean;
  homeCity: string;
  phone?: string; // admin only
}

export interface PlanView extends Plan {
  isCurrent: boolean;
  accepts: string[];
  declines: { name: string; reason: string | null }[];
  pending: string[];
  votes: Record<string, "accept" | "decline">; // memberId -> decision
  dependsOnMaybe: string[];
}

export interface TripView {
  trip: {
    id: string;
    slug: string;
    name: string;
    targetMonth: string;
    deadline: string;
    status: TripStatus;
    blendRound: number;
    agreedPlanId: string | null;
    isDemo: boolean;
  };
  now: string;
  today: string;
  deadlinePassed: boolean;
  members: MemberView[];
  dates: DatesResult;
  openMaybes: { memberId: string; name: string; days: string[]; knownBy: string | null; due: boolean }[];
  currentPlans: PlanView[];
  earlierPlans: PlanView[];
  rejectedPlans: PlanView[];
  agreedPlan: PlanView | null;
  closest: { plan: PlanView; unhappy: { name: string; reason: string | null }[] } | null;
  changes: ChangeEntry[];
  readyToPlan: boolean;
}

export function buildView(b: TripBundle, now: Date, opts: { admin?: boolean } = {}): TripView {
  const passed = isDeadlinePassed(b, now);
  const dates = datesFor(b, now);
  const name = (id: string) => b.members.find((m) => m.id === id)?.name ?? "?";

  const members: MemberView[] = b.members.map((m) => ({
    id: m.id,
    name: m.name,
    isCoordinator: m.is_coordinator,
    submitted: Boolean(m.submitted_at),
    assumed: !m.submitted_at && passed,
    updatedAt: m.updated_at,
    confirmed: Boolean(m.confirmed_at),
    homeCity: b.preferences.find((p) => p.member_id === m.id)?.home_city ?? "",
    ...(opts.admin ? { phone: m.phone } : {}),
  }));

  const planView = (p: Plan): PlanView => {
    const s = b.swipes.filter((x) => x.plan_id === p.id);
    const votes = Object.fromEntries(s.map((x) => [x.member_id, x.decision]));
    const live = p.status === "active" || p.status === "agreed";
    return {
      ...p,
      isCurrent: p.status === "active" && p.round === b.trip.blend_round,
      accepts: s.filter((x) => x.decision === "accept").map((x) => name(x.member_id)),
      declines: s.filter((x) => x.decision === "decline").map((x) => ({ name: name(x.member_id), reason: x.reason })),
      pending: b.members.filter((m) => !votes[m.id]).map((m) => m.name),
      votes,
      dependsOnMaybe: live ? checkPlan(p, b.members, b.preferences, dates, {}).dependsOnMaybe : [],
    };
  };

  const plans = b.plans.map(planView);
  const active = plans.filter((p) => p.status === "active");
  const agreedPlan = plans.find((p) => p.id === b.trip.agreed_plan_id) ?? null;

  let closest: TripView["closest"] = null;
  if (b.trip.status === "stuck" && active.length) {
    const top = [...active].sort((a, z) => z.accepts.length - a.accepts.length || z.created_at.localeCompare(a.created_at))[0];
    closest = { plan: top, unhappy: top.declines };
  }

  const today = istDay(now);
  const maybeRows = b.availability.filter((a) => a.status === "maybe");
  const openMaybes = b.members
    .map((m) => {
      const rows = maybeRows.filter((r) => r.member_id === m.id);
      if (!rows.length) return null;
      const knownBy = rows.map((r) => r.maybe_known_by).filter(Boolean).sort()[0] ?? null;
      return { memberId: m.id, name: m.name, days: rows.map((r) => r.day).sort(), knownBy, due: Boolean(knownBy && knownBy <= today) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  return {
    trip: {
      id: b.trip.id,
      slug: b.trip.slug,
      name: b.trip.name,
      targetMonth: b.trip.target_month,
      deadline: b.trip.deadline,
      status: b.trip.status,
      blendRound: b.trip.blend_round,
      agreedPlanId: b.trip.agreed_plan_id,
      isDemo: b.trip.is_demo,
    },
    now: now.toISOString(),
    today,
    deadlinePassed: passed,
    members,
    dates,
    openMaybes,
    currentPlans: plans.filter((p) => p.isCurrent),
    earlierPlans: active.filter((p) => !p.isCurrent),
    rejectedPlans: plans.filter((p) => p.status === "rejected" || p.status === "broken"),
    agreedPlan,
    closest,
    changes: b.changes,
    readyToPlan: readyToPlan(b, dates, now),
  };
}
