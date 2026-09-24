// The app's brain: saving answers, spotting changes, generating/regenerating plans and deciding.
import "server-only";

import { blendPlans, generatePlans, type PlanSource } from "./gemini";
import { findCommonDates, type DatesResult } from "./dates";
import { VETO_BY_KEY, VETOES, VIBES, ACTIVITIES } from "./options";
import type { PlanContext, VoteSummary } from "./plan-context";
import { checkPlan } from "./rules";
import { store } from "./store";
import type { NewPlan } from "./store/types";
import { fmtDay, fmtRange, monthDays } from "./time";
import type { AvailabilityRow, DayStatus, Member, Plan, PlanDraft, Preferences, TripBundle } from "./types";

export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const MAX_BLEND_ROUNDS = 2;

export async function load(slug: string): Promise<TripBundle> {
  const b = await store.getBundle(slug);
  if (!b) throw new AppError(404, "Trip not found");
  return b;
}

export function isDeadlinePassed(b: TripBundle, now: Date) {
  return now.getTime() >= Date.parse(b.trip.deadline);
}

export function datesFor(b: TripBundle, now: Date): DatesResult {
  return findCommonDates(b.members, b.availability, b.trip.target_month, isDeadlinePassed(b, now));
}

export function readyToPlan(b: TripBundle, dates: DatesResult, now: Date) {
  const everyoneIn = b.members.every((m) => m.submitted_at) || isDeadlinePassed(b, now);
  return b.trip.status === "collecting" && everyoneIn && dates.full.length + dates.maybe.length > 0;
}

function planContext(b: TripBundle, dates: DatesResult, ceiling: number | null, now: Date): PlanContext {
  const passed = isDeadlinePassed(b, now);
  return {
    tripName: b.trip.name,
    month: b.trip.target_month,
    budgetCeiling: ceiling,
    windows: [
      ...dates.full.map((w) => ({ start: w.start, end: w.end, kind: "everyone_free" as const, unsure: [] })),
      ...dates.maybe.map((w) => ({
        start: w.start,
        end: w.end,
        kind: "depends_on_maybe" as const,
        unsure: w.unsure.map((u) => `${u.name}${u.knownBy ? ` (knows by ${u.knownBy})` : ""}`),
      })),
    ],
    people: b.members.map((m) => {
      const p = m.submitted_at ? b.preferences.find((x) => x.member_id === m.id) : undefined;
      return {
        name: m.name,
        homeCity: p?.home_city ?? "",
        vibes: p?.vibes ?? [],
        activities: p?.activities ?? [],
        vetoes: p?.vetoes ?? [],
        vetoNotes: p?.veto_notes ?? "",
        wishes: p?.wishes ?? "",
        assumed: !m.submitted_at && passed,
      };
    }),
  };
}

async function validate(b: TripBundle, dates: DatesResult, drafts: PlanDraft[]) {
  const fits = await store.budgetFits(
    b.trip.id,
    drafts.map((d) => d.cost_per_person),
  );
  return drafts.map((d, i) => ({ draft: d, result: checkPlan(d, b.members, b.preferences, dates, fits[i]) }));
}

function newPlan(b: TripBundle, d: PlanDraft, extra: Partial<NewPlan>): NewPlan {
  return {
    trip_id: b.trip.id,
    round: b.trip.blend_round,
    kind: "initial",
    source_plan_ids: [],
    replaces_plan_id: null,
    status: "active",
    status_reason: null,
    ...d,
    ...extra,
  };
}

const log = (b: TripBundle, summary: string, kind = "system", memberId: string | null = null) =>
  store.addChange({ trip_id: b.trip.id, member_id: memberId, kind, summary });

const sourceNote = (s: PlanSource) => (s === "sample" ? " (sample plans — add a Gemini key for real ones)" : "");

/** Ask for plans until we have `count` that pass every rule (max 3 attempts). */
async function producePlans(b: TripBundle, dates: DatesResult, count: number, avoid: string[], feedback: string[], now: Date) {
  const ceiling = await store.budgetCeiling(b.trip.id);
  const ctx = planContext(b, dates, ceiling, now);
  const good: PlanDraft[] = [];
  const rejected: { draft: PlanDraft; reason: string }[] = [];
  let source: PlanSource = "sample";
  const started = Date.now();
  // Retry for rule-breaking plans, but stop early so the request stays inside Vercel's time limit.
  for (let attempt = 0; attempt < 3 && good.length < count && Date.now() - started < 25_000; attempt++) {
    const out = await generatePlans(ctx, count - good.length, [...avoid], [...feedback]);
    source = out.source;
    if (!out.plans.length) break;
    for (const { draft, result } of await validate(b, dates, out.plans)) {
      avoid.push(draft.destination);
      if (result.ok) good.push(draft);
      else {
        const reason = result.problems.join("; ");
        rejected.push({ draft, reason });
        feedback.push(`${draft.destination} ${draft.start_date}: ${reason}`);
      }
    }
  }
  return { good: good.slice(0, count), rejected, source };
}

// ---------------------------------------------------------------------------
// 1. Initial plans

export async function generateInitialPlans(slug: string, now: Date, force = false) {
  const b = await load(slug);
  const dates = datesFor(b, now);
  if (!force && !readyToPlan(b, dates, now)) return { generated: false };
  if (dates.full.length + dates.maybe.length === 0) throw new AppError(409, "No common dates yet — nothing to plan around.");
  if (!(await store.claimTrip(b.trip.id, { status: "collecting" }, { status: "voting", blend_round: 0 }))) {
    return { generated: false };
  }
  b.trip.status = "voting";
  b.trip.blend_round = 0;
  try {
    const { good, rejected, source } = await producePlans(b, dates, 3, [], [], now);
    await store.insertPlans([
      ...rejected.map((r) => newPlan(b, r.draft, { status: "rejected", status_reason: r.reason })),
      ...good.map((d) => newPlan(b, d, {})),
    ]);
    for (const r of rejected) await log(b, `🚫 Code threw out a ${r.draft.destination} plan: ${r.reason}`, "rejected");
    await log(
      b,
      good.length
        ? `✨ ${good.length} trip plan${good.length > 1 ? "s are" : " is"} ready — everyone swipe!${sourceNote(source)}`
        : "😕 No plan passed everyone's hard no's, budgets and dates. Riya can try again.",
      "plans",
    );
    return { generated: true };
  } catch (err) {
    await store.updateTrip(b.trip.id, { status: "collecting" });
    throw err;
  }
}

/** Riya's "get fresh plans" button: replaces the current round's live plans with 3 new ones. */
export async function freshPlans(slug: string, now: Date) {
  const b = await load(slug);
  if (b.trip.status === "collecting") return generateInitialPlans(slug, now, true);
  if (b.trip.status === "confirmed") throw new AppError(409, "The plan is frozen.");
  const dates = datesFor(b, now);
  const current = b.plans.filter((p) => p.status === "active" && p.round === b.trip.blend_round);
  const { good, rejected, source } = await producePlans(b, dates, 3, current.map((p) => p.destination), [], now);
  if (!good.length) throw new AppError(422, "Couldn't find plans that pass everyone's rules. Try changing dates or hard no's.");
  for (const p of current) await store.updatePlan(p.id, { status: "superseded", status_reason: "Riya asked for fresh plans" });
  if (b.trip.agreed_plan_id) {
    await store.updatePlan(b.trip.agreed_plan_id, { status: "superseded" });
    for (const m of b.members) if (m.confirmed_at) await store.updateMember(m.id, { confirmed_at: null });
  }
  await store.updateTrip(b.trip.id, { status: "voting", agreed_plan_id: null });
  await store.insertPlans([
    ...rejected.map((r) => newPlan(b, r.draft, { status: "rejected", status_reason: r.reason })),
    ...good.map((d) => newPlan(b, d, {})),
  ]);
  await log(b, `🔄 Riya asked for fresh plans — ${good.length} new ones to swipe${sourceNote(source)}`, "plans");
  return { generated: true };
}

// ---------------------------------------------------------------------------
// 2. Saving a friend's answers (+ change detection mid-way)

export interface AnswersInput {
  availability: { day: string; status: DayStatus; maybe_known_by?: string | null }[];
  home_city: string;
  vibes: string[];
  activities: string[];
  vetoes: string[];
  veto_notes: string;
  wishes: string;
  budget?: { min: number; max: number } | null;
}

function describeDays(days: string[]) {
  const list = days.slice(0, 4).map((d) => fmtDay(d));
  return list.join(", ") + (days.length > 4 ? ` +${days.length - 4} more` : "");
}

function diffAnswers(member: Member, before: { avail: AvailabilityRow[]; prefs?: Preferences }, after: AnswersInput, budgetChanged: boolean) {
  const out: string[] = [];
  const old = new Map(before.avail.map((a) => [a.day, a.status]));
  const now = new Map(after.availability.map((a) => [a.day, a.status]));
  const allDays = [...new Set([...old.keys(), ...now.keys()])].sort();
  const resolvedYes: string[] = [];
  const resolvedNo: string[] = [];
  const nowFree: string[] = [];
  const nowBusy: string[] = [];
  const nowMaybe: string[] = [];
  for (const d of allDays) {
    const a = old.get(d) ?? "busy";
    const z = now.get(d) ?? "busy";
    if (a === z) continue;
    if (a === "maybe" && z === "free") resolvedYes.push(d);
    else if (a === "maybe" && z === "busy") resolvedNo.push(d);
    else if (z === "free") nowFree.push(d);
    else if (z === "busy") nowBusy.push(d);
    else nowMaybe.push(d);
  }
  const n = member.name;
  if (resolvedYes.length) out.push(`${n}'s maybe turned into a YES for ${describeDays(resolvedYes)} 🎉`);
  if (resolvedNo.length) out.push(`${n}'s maybe turned into a no for ${describeDays(resolvedNo)}`);
  if (nowFree.length) out.push(`${n} is now free on ${describeDays(nowFree)}`);
  if (nowBusy.length) out.push(`${n} can no longer do ${describeDays(nowBusy)}`);
  if (nowMaybe.length) out.push(`${n} marked ${describeDays(nowMaybe)} as maybe`);

  const p = before.prefs;
  const label = (k: string) => VETO_BY_KEY[k]?.label ?? k;
  const added = after.vetoes.filter((v) => !p?.vetoes.includes(v));
  const removed = (p?.vetoes ?? []).filter((v) => !after.vetoes.includes(v));
  if (added.length) out.push(`${n} added hard no's: ${added.map(label).join(", ")}`);
  if (removed.length) out.push(`${n} dropped hard no's: ${removed.map(label).join(", ")}`);
  if ((p?.veto_notes ?? "") !== after.veto_notes && after.veto_notes) out.push(`${n} updated other hard no's: "${after.veto_notes}"`);
  const same = (x: string[] = [], y: string[]) => x.length === y.length && x.every((v) => y.includes(v));
  if (!same(p?.vibes, after.vibes) || !same(p?.activities, after.activities) || (p?.wishes ?? "") !== after.wishes) {
    out.push(`${n} updated what they want to do`);
  }
  if ((p?.home_city ?? "") !== after.home_city) out.push(`${n} is now travelling from ${after.home_city}`);
  if (budgetChanged) out.push(`${n} updated their budget (kept private 🔒)`);
  return out;
}

export async function saveAnswers(slug: string, memberId: string, input: AnswersInput, now: Date) {
  const b = await load(slug);
  const member = b.members.find((m) => m.id === memberId);
  if (!member) throw new AppError(404, "Unknown member");
  if (b.trip.status === "confirmed") throw new AppError(409, "Everyone confirmed — the plan is frozen 🔒");

  // Sanitise.
  const month = new Set(monthDays(b.trip.target_month));
  const availability: AvailabilityRow[] = input.availability
    .filter((a) => month.has(a.day) && ["free", "busy", "maybe"].includes(a.status))
    .map((a) => ({
      member_id: memberId,
      day: a.day,
      status: a.status,
      maybe_known_by: a.status === "maybe" && a.maybe_known_by && /^\d{4}-\d{2}-\d{2}$/.test(a.maybe_known_by) ? a.maybe_known_by : null,
    }));
  const valid = (keys: string[], opts: { key: string }[]) => [...new Set(keys)].filter((k) => opts.some((o) => o.key === k));
  const clean: AnswersInput = {
    ...input,
    availability,
    home_city: String(input.home_city ?? "").trim().slice(0, 60),
    vibes: valid(input.vibes ?? [], VIBES),
    activities: valid(input.activities ?? [], ACTIVITIES),
    vetoes: valid(input.vetoes ?? [], VETOES),
    veto_notes: String(input.veto_notes ?? "").trim().slice(0, 300),
    wishes: String(input.wishes ?? "").trim().slice(0, 300),
  };
  const budget = input.budget && input.budget.max > 0 ? { min: Math.max(0, Math.min(input.budget.min, input.budget.max)), max: input.budget.max } : null;
  if (!budget && !member.has_budget) throw new AppError(400, "Please add a budget range (only you can see it).");

  const before = {
    avail: b.availability.filter((a) => a.member_id === memberId),
    prefs: b.preferences.find((p) => p.member_id === memberId),
  };
  const firstTime = !member.submitted_at;
  const changes = firstTime ? [] : diffAnswers(member, before, clean, Boolean(budget));

  await store.replaceAvailability(b.trip.id, memberId, availability);
  await store.upsertPreferences(b.trip.id, {
    member_id: memberId,
    home_city: clean.home_city,
    vibes: clean.vibes,
    activities: clean.activities,
    vetoes: clean.vetoes,
    veto_notes: clean.veto_notes,
    wishes: clean.wishes,
  });
  if (budget) await store.setBudget(memberId, budget.min, budget.max);
  const stamp = new Date().toISOString();
  await store.updateMember(memberId, { submitted_at: member.submitted_at ?? stamp, updated_at: stamp });

  const late = firstTime && isDeadlinePassed(b, now);
  if (firstTime) await log(b, `${member.name} is in ✅${late ? " (after the deadline — replacing the 'assumed free' guess)" : ""}`, "submitted", memberId);
  const afterAgree = b.trip.status === "agreed" ? "After agreeing: " : "";
  for (const c of changes) await log(b, `${afterAgree}${c}`, "edit", memberId);

  let reconcileResult: Awaited<ReturnType<typeof reconcile>> | null = null;
  if (b.trip.status !== "collecting" && (changes.length || late)) reconcileResult = await reconcile(slug, now);
  else if (b.trip.status === "collecting") await generateInitialPlans(slug, now).catch((e) => console.error(e));
  return { ok: true, changes, reconcile: reconcileResult };
}

// ---------------------------------------------------------------------------
// 3. Re-check live plans after a change; regenerate only the broken ones

export async function reconcile(slug: string, now: Date) {
  const b = await load(slug);
  if (b.trip.status === "confirmed" || b.trip.status === "collecting") return { broken: [], replaced: [] };
  const dates = datesFor(b, now);
  const live = b.plans.filter((p) => p.status === "active" || p.status === "agreed");
  const checks = await validate(b, dates, live);
  const broken: { plan: Plan; reason: string }[] = [];
  for (let i = 0; i < live.length; i++) {
    const { result } = checks[i];
    if (result.ok) continue;
    const plan = live[i];
    const reason = result.problems.join("; ");
    broken.push({ plan, reason });
    await store.updatePlan(plan.id, { status: "broken", status_reason: reason });
    await log(b, `⚠️ ${plan.destination} (${fmtRange(plan.start_date, plan.end_date)}) no longer works: ${reason}`, "broken");
  }
  if (!broken.length) {
    await decide(slug, now);
    return { broken: [], replaced: [] };
  }

  const agreedBroke = broken.some((x) => x.plan.id === b.trip.agreed_plan_id);
  if (agreedBroke) {
    await store.updateTrip(b.trip.id, { status: "voting", agreed_plan_id: null });
    for (const m of b.members) if (m.confirmed_at) await store.updateMember(m.id, { confirmed_at: null });
    await log(b, "↩️ The agreed plan broke, so we're back to voting on a fixed version.", "unlock");
  }

  // Only plans people are voting on right now (or the agreed one) need a replacement.
  const toReplace = broken.filter((x) => x.plan.round === b.trip.blend_round || x.plan.id === b.trip.agreed_plan_id);
  const stillLive = live.filter((p) => !broken.some((x) => x.plan.id === p.id)).map((p) => p.destination);
  const replaced: string[] = [];
  for (const { plan, reason } of toReplace) {
    const { good, source } = await producePlans(b, dates, 1, [...stillLive], [`${plan.destination} ${plan.start_date}: ${reason}`], now);
    if (!good.length) {
      await log(b, `😕 Couldn't find a replacement for ${plan.destination} that works for everyone.`, "broken");
      continue;
    }
    await store.insertPlans([newPlan(b, good[0], { kind: "replacement", replaces_plan_id: plan.id, round: b.trip.blend_round })]);
    stillLive.push(good[0].destination);
    replaced.push(good[0].destination);
    const what =
      good[0].destination === plan.destination
        ? `Moved ${plan.destination} to ${fmtRange(good[0].start_date, good[0].end_date)}`
        : `Replaced ${plan.destination} with ${good[0].destination} (${fmtRange(good[0].start_date, good[0].end_date)})`;
    await log(b, `🔁 ${what} — swipe on it!${sourceNote(source)}`, "replaced");
  }
  if (replaced.length && b.trip.status === "stuck") await store.updateTrip(b.trip.id, { status: "voting" });
  await decide(slug, now);
  return { broken: broken.map((x) => x.plan.destination), replaced };
}

// ---------------------------------------------------------------------------
// 4. Swipes and deciding (no majority rule)

export async function swipe(slug: string, memberId: string, planId: string, decision: "accept" | "decline", reason: string | null, now: Date) {
  const b = await load(slug);
  if (!b.members.some((m) => m.id === memberId)) throw new AppError(404, "Unknown member");
  if (!["voting", "stuck"].includes(b.trip.status)) throw new AppError(409, "Voting is closed.");
  const plan = b.plans.find((p) => p.id === planId);
  if (!plan || plan.status !== "active") throw new AppError(409, "That plan isn't open for votes any more.");
  await store.upsertSwipe(b.trip.id, {
    plan_id: planId,
    member_id: memberId,
    decision,
    reason: decision === "decline" ? (reason?.slice(0, 140) ?? null) : null,
  });
  return decide(slug, now);
}

function tally(b: TripBundle, plan: Plan): VoteSummary {
  const s = b.swipes.filter((x) => x.plan_id === plan.id);
  const name = (id: string) => b.members.find((m) => m.id === id)?.name ?? "?";
  return {
    plan,
    accepted: s.filter((x) => x.decision === "accept").map((x) => name(x.member_id)),
    declined: s.filter((x) => x.decision === "decline").map((x) => ({ name: name(x.member_id), reason: x.reason })),
  };
}

export async function decide(slug: string, now: Date): Promise<{ outcome: string }> {
  const b = await load(slug);
  const { trip, members, swipes } = b;
  if (trip.status !== "voting" && trip.status !== "stuck") return { outcome: "none" };
  const active = b.plans.filter((p) => p.status === "active");
  const current = active.filter((p) => p.round === trip.blend_round);
  const everyoneAccepts = (p: Plan) => members.every((m) => swipes.some((s) => s.plan_id === p.id && s.member_id === m.id && s.decision === "accept"));

  // Unanimous winner — any live plan counts, including earlier-round ones people changed their mind on.
  const winner = [...current, ...active.filter((p) => p.round !== trip.blend_round)].find(everyoneAccepts);
  if (winner) {
    if (await store.claimTrip(trip.id, { status: trip.status, blend_round: trip.blend_round }, { status: "agreed", agreed_plan_id: winner.id })) {
      await store.updatePlan(winner.id, { status: "agreed" });
      await log(b, `🎉 AGREED: all ${members.length} said yes to ${winner.destination} (${fmtRange(winner.start_date, winner.end_date)}). Now tap "I'm confirmed" once your leave is sorted.`, "agreed");
    }
    return { outcome: "agreed" };
  }
  if (trip.status === "stuck" || !current.length) return { outcome: "waiting" };
  const allSwiped = members.every((m) => current.every((p) => swipes.some((s) => s.plan_id === p.id && s.member_id === m.id)));
  if (!allSwiped) return { outcome: "waiting" };

  const ranked = active
    .map((p) => tally(b, p))
    .sort((a, b2) => b2.accepted.length - a.accepted.length || (b2.plan.created_at ?? "").localeCompare(a.plan.created_at ?? ""));

  if (trip.blend_round >= MAX_BLEND_ROUNDS) {
    if (await store.claimTrip(trip.id, { status: "voting", blend_round: trip.blend_round }, { status: "stuck" })) {
      const top = ranked[0];
      await log(b, `🤝 No plan got everyone after ${MAX_BLEND_ROUNDS} blends. Closest: ${top?.plan.destination ?? "—"} (${top?.accepted.length ?? 0}/${members.length} yes). Riya's dashboard shows who's unhappy and why.`, "stuck");
    }
    return { outcome: "stuck" };
  }

  const next = trip.blend_round + 1;
  if (!(await store.claimTrip(trip.id, { status: "voting", blend_round: trip.blend_round }, { blend_round: next }))) return { outcome: "waiting" };
  b.trip.blend_round = next;

  const dates = datesFor(b, now);
  const top = ranked.slice(0, 2);
  const ceiling = await store.budgetCeiling(trip.id);
  const ctx = planContext(b, dates, ceiling, now);
  const feedback: string[] = [];
  for (let attempt = 0; attempt < 3; attempt++) {
    const earlierBlends = b.plans.filter((p) => p.kind === "blend").map((p) => p.destination);
    const avoid = [...earlierBlends, ...top.map((t) => t.plan.destination).slice(0, attempt)];
    const { plan, source } = await blendPlans(ctx, top, next, avoid, feedback);
    if (!plan) break;
    const [{ result }] = await validate(b, dates, [plan]);
    if (!result.ok) {
      feedback.push(`${plan.destination}: ${result.problems.join("; ")}`);
      await log(b, `🚫 Code threw out a blend (${plan.destination}): ${result.problems.join("; ")}`, "rejected");
      continue;
    }
    await store.insertPlans([newPlan(b, plan, { kind: "blend", round: next, source_plan_ids: top.map((t) => t.plan.id!) })]);
    const split = top.map((t) => `${t.plan.destination} ${t.accepted.length}–${t.declined.length}`).join(", ");
    await log(b, `🧪 Split vote (${split}). Blend ${next}/${MAX_BLEND_ROUNDS} is ready: ${plan.destination} — mixes the most-liked bits of each side. Everyone swipe again!${sourceNote(source)}`, "blend");
    return { outcome: "blend" };
  }
  await store.updateTrip(trip.id, { status: "stuck" });
  await log(b, "😕 Couldn't build a blend that respects everyone's hard no's and budgets. Riya's dashboard has the closest plan.", "stuck");
  return { outcome: "stuck" };
}

// ---------------------------------------------------------------------------
// 5. Two-step lock

export async function setConfirmed(slug: string, memberId: string, confirmed: boolean) {
  const b = await load(slug);
  const m = b.members.find((x) => x.id === memberId);
  if (!m) throw new AppError(404, "Unknown member");
  if (b.trip.status !== "agreed") throw new AppError(409, b.trip.status === "confirmed" ? "Already frozen 🔒" : "Nothing agreed yet.");
  await store.updateMember(memberId, { confirmed_at: confirmed ? new Date().toISOString() : null });
  await log(b, confirmed ? `${m.name} is confirmed — leave sorted ✅` : `${m.name} un-confirmed (leave not sorted yet)`, "confirm", memberId);
  const others = b.members.filter((x) => x.id !== memberId);
  if (confirmed && others.every((x) => x.confirmed_at)) {
    if (await store.claimTrip(b.trip.id, { status: "agreed" }, { status: "confirmed" })) {
      await log(b, "🔒 CONFIRMED: everyone's leave is sorted. The plan is frozen — go book it!", "confirmed");
    }
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 6. On-load housekeeping: announce "assumed available" once the deadline passes.
// (Plan generation itself is kicked off by the page, so it can show a loading state.)

export async function housekeeping(slug: string, now: Date) {
  const b = await load(slug);
  if (isDeadlinePassed(b, now)) {
    for (const m of b.members.filter((x) => !x.submitted_at)) {
      if (b.changes.some((c) => c.kind === "assumed" && c.member_id === m.id)) continue;
      await log(b, `⏰ ${m.name} missed the deadline, so we're assuming they're free every day, with no hard no's and an average budget.`, "assumed", m.id);
    }
  }
}
