// Turns a TripBundle into what the pages render. Pure, serialisable, and never contains budgets.
import "server-only";

import type { DatesResult } from "./dates";
import { checkPlan } from "./rules";
import { assumeMissing, datesFor, everyoneAnswered, isDeadlinePassed, readyToPlan } from "./service";
import { istDay } from "./time";
import type { ChangeEntry, Idea, Plan, TripBundle, TripStatus } from "./types";

export interface MemberView {
  id: string;
  name: string;
  isCoordinator: boolean;
  submitted: boolean;
  assumed: boolean;
  updatedAt: string | null;
  confirmed: boolean;
  homeCity: string;
  hasPhone: boolean;
  phone?: string; // admin only
  progress: { dates: number; ideas: number; budget: boolean; passes: boolean };
}

export interface IdeaView extends Idea {
  likedBy: string[];
  passedBy: string[];
}

export interface PlanView extends Plan {
  isCurrent: boolean;
  accepts: string[];
  declines: { name: string; reason: string | null }[];
  pending: string[];
  votes: Record<string, "accept" | "decline">; // memberId -> decision
  voteTimes: Record<string, string>; // memberId -> when they swiped
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
  totals: { dates: number; ideas: number };
  dates: DatesResult;
  openMaybes: { memberId: string; name: string; ranges: { start: string; end: string }[]; knownBy: string | null; due: boolean }[];
  ideas: IdeaView[];
  currentPlans: PlanView[];
  earlierPlans: PlanView[];
  rejectedPlans: PlanView[];
  agreedPlan: PlanView | null;
  closest: { plan: PlanView; unhappy: { name: string; reason: string | null }[] } | null;
  changes: ChangeEntry[];
  readyToPlan: boolean;
  everyoneAnswered: boolean;
  receipt: Receipt | null;
}

/** Proof of what the group decided — shown once a plan is agreed. */
export interface Receipt {
  agreedAt: string | null;
  frozenAt: string | null;
  people: { id: string; name: string; homeCity: string; saidYesAt: string | null; confirmedAt: string | null }[];
  changesAlongTheWay: number;
  hardPassesRespected: number;
  plansConsidered: number;
}

export function buildView(b: TripBundle, now: Date, opts: { admin?: boolean } = {}): TripView {
  const passed = isDeadlinePassed(b, now);
  const assume = assumeMissing(b, now);
  const dates = datesFor(b, now);
  const name = (id: string) => b.members.find((m) => m.id === id)?.name ?? "?";

  const members: MemberView[] = b.members.map((m) => ({
    id: m.id,
    name: m.name,
    isCoordinator: m.is_coordinator,
    submitted: Boolean(m.submitted_at),
    assumed: !m.submitted_at && assume,
    updatedAt: m.updated_at,
    confirmed: Boolean(m.confirmed_at),
    homeCity: b.preferences.find((p) => p.member_id === m.id)?.home_city ?? "",
    hasPhone: m.phone.replace(/\D/g, "").length >= 8,
    ...(opts.admin ? { phone: m.phone } : {}),
    progress: {
      dates: b.dateVotes.filter((v) => v.member_id === m.id && b.dateOptions.some((o) => o.id === v.option_id)).length,
      ideas: b.ideaSwipes.filter((s) => s.member_id === m.id).length,
      budget: m.has_budget,
      passes: Boolean(m.submitted_at),
    },
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
      voteTimes: Object.fromEntries(s.map((x) => [x.member_id, x.updated_at])),
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
  const openMaybes = b.members
    .map((m) => {
      const rows = b.dateVotes.filter((v) => v.member_id === m.id && v.vote === "maybe");
      if (!rows.length) return null;
      const knownBy = rows.map((r) => r.known_by).filter(Boolean).sort()[0] ?? null;
      const ranges = rows
        .map((r) => b.dateOptions.find((o) => o.id === r.option_id))
        .filter((o) => o !== undefined)
        .map((o) => ({ start: o.start_date, end: o.end_date }));
      return { memberId: m.id, name: m.name, ranges, knownBy, due: Boolean(knownBy && knownBy <= today) };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const ideas: IdeaView[] = b.ideas.map((i) => ({
    ...i,
    likedBy: b.ideaSwipes.filter((s) => s.idea_id === i.id && s.liked).map((s) => name(s.member_id)),
    passedBy: b.ideaSwipes.filter((s) => s.idea_id === i.id && !s.liked).map((s) => name(s.member_id)),
  }));

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
    totals: { dates: b.dateOptions.length, ideas: b.ideas.length },
    dates,
    openMaybes,
    ideas,
    currentPlans: plans.filter((p) => p.isCurrent),
    earlierPlans: active.filter((p) => !p.isCurrent),
    rejectedPlans: plans.filter((p) => p.status === "rejected" || p.status === "broken"),
    agreedPlan,
    closest,
    changes: b.changes,
    readyToPlan: readyToPlan(b, dates, now),
    everyoneAnswered: everyoneAnswered(b),
    receipt: agreedPlan
      ? {
          agreedAt: b.changes.find((c) => c.kind === "agreed")?.created_at ?? null, // newest first
          frozenAt: b.changes.find((c) => c.kind === "confirmed")?.created_at ?? null,
          people: b.members.map((m) => ({
            id: m.id,
            name: m.name,
            homeCity: b.preferences.find((p) => p.member_id === m.id)?.home_city ?? "",
            saidYesAt: agreedPlan.voteTimes[m.id] ?? null,
            confirmedAt: m.confirmed_at,
          })),
          changesAlongTheWay: b.changes.filter((c) => c.kind === "edit").length,
          hardPassesRespected: new Set(b.preferences.flatMap((p) => p.vetoes)).size,
          plansConsidered: b.plans.length,
        }
      : null,
  };
}
