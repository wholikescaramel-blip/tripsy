// The app's brain: people & date options, saving each tap, spotting changes,
// generating / fixing plans, and deciding. Everything is worked out on demand — no background jobs.
import "server-only";

import { dateResults, suggestDateOptions, type DatesResult } from "./dates";
import { AppError } from "./errors";
import { blendPlans, generateIdeas, generatePlans, type PlanSource } from "./gemini";
import { BUDGET_TIERS, KNOW_BY, VETO_BY_KEY, VETOES, matchHardPasses } from "./options";
import type { PlanContext, VoteSummary } from "./plan-context";
import { checkPlan } from "./rules";
import { store } from "./store";
import type { NewPlan } from "./store/types";
import { addDays, daysBetween, fmtDateTime, fmtRange, istDay } from "./time";
import type { DateVoteValue, IdeaDraft, Plan, PlanDraft, TripBundle } from "./types";

export { AppError };

/** Split vote → one blended plan. If that still isn't a yes from everyone, show the closest plan. */
export const MAX_BLEND_ROUNDS = 1;

export async function load(slug: string): Promise<TripBundle> {
  const b = await store.getBundle(slug);
  if (!b) throw new AppError(404, "Trip not found");
  return b;
}

function memberOf(b: TripBundle, memberId: string) {
  const m = b.members.find((x) => x.id === memberId);
  if (!m) throw new AppError(404, "That person isn't on this trip any more.");
  return m;
}

function notFrozen(b: TripBundle) {
  if (b.trip.status === "confirmed") throw new AppError(409, "Everyone confirmed — the plan is frozen 🔒");
}

export function isDeadlinePassed(b: TripBundle, now: Date) {
  return now.getTime() >= Date.parse(b.trip.deadline);
}

/**
 * Missing answers count as "yes to every date, no hard passes, average budget" once the deadline
 * passes — or once planning has started, so a late change doesn't wipe out every plan.
 */
export function assumeMissing(b: TripBundle, now: Date) {
  return isDeadlinePassed(b, now) || b.trip.status !== "collecting";
}

export function datesFor(b: TripBundle, now: Date): DatesResult {
  return dateResults(b.members, b.dateOptions, b.dateVotes, assumeMissing(b, now));
}

export function everyoneAnswered(b: TripBundle) {
  return b.members.every((m) => m.submitted_at);
}

export function readyToPlan(b: TripBundle, dates: DatesResult, now: Date) {
  const go = isDeadlinePassed(b, now) || everyoneAnswered(b);
  return b.trip.status === "collecting" && b.members.length >= 2 && go && dates.full.length + dates.maybe.length > 0;
}

const log = (b: TripBundle, summary: string, kind = "system", memberId: string | null = null) =>
  store.addChange({ trip_id: b.trip.id, member_id: memberId, kind, summary });

const sourceNote = (s: PlanSource) => (s === "sample" ? " (sample plans — add a Gemini key for real ones)" : "");

// ---------------------------------------------------------------------------
// 1. Setting up: trip, people, date options

export async function createTrip(input: {
  slug: string;
  adminKey: string;
  name: string;
  month: string; // YYYY-MM
  deadline: string; // ISO
  isDemo?: boolean;
  people: { name: string; phone: string }[]; // first one is the coordinator
  ideas?: IdeaDraft[]; // fixed cards (demo); otherwise Gemini suggests them
}) {
  const b = await store.createTrip({
    slug: input.slug,
    admin_key: input.adminKey,
    name: input.name,
    target_month: `${input.month}-01`,
    deadline: input.deadline,
    is_demo: Boolean(input.isDemo),
    members: input.people.map((p, i) => ({ ...p, is_coordinator: i === 0 })),
  });
  await store.addDateOptions(
    b.trip.id,
    suggestDateOptions(b.trip.target_month).map((o) => ({ ...o, added_by: "app" as const })),
  );
  const ideas = input.ideas ?? (await generateIdeas(b.trip.target_month)).ideas;
  await store.insertIdeas(b.trip.id, ideas);
  return b;
}

const cleanName = (s: string) => s.trim().replace(/\s+/g, " ").slice(0, 30);

export async function addPerson(slug: string, rawName: string, phone: string) {
  const b = await load(slug);
  notFrozen(b);
  const name = cleanName(rawName);
  if (!name) throw new AppError(400, "Add a name.");
  if (b.members.length >= 20) throw new AppError(409, "That's a big group! 20 people max.");
  if (b.members.some((m) => m.name.toLowerCase() === name.toLowerCase())) throw new AppError(409, `${name} is already on the list — add a surname to tell them apart.`);
  const m = await store.addMember(b.trip.id, { name, phone: phone.trim().slice(0, 20) });
  await log(b, `👋 ${name} was added to the trip${b.trip.status !== "collecting" ? " (plans will be re-checked once they answer)" : ""}`, "people", m.id);
  return { memberId: m.id };
}

export async function removePerson(slug: string, memberId: string, now: Date) {
  const b = await load(slug);
  notFrozen(b);
  const m = memberOf(b, memberId);
  if (m.is_coordinator) throw new AppError(409, "The coordinator can't be removed.");
  await store.removeMember(memberId);
  await log(b, `${m.name} was removed from the trip`, "people");
  if (b.trip.status !== "collecting") await reconcile(slug, now);
  return { ok: true };
}

export async function addDateOption(slug: string, start: string, end: string, now: Date) {
  const b = await load(slug);
  notFrozen(b);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) throw new AppError(400, "Pick both dates.");
  const len = daysBetween(start, end) + 1;
  if (len < 1 || len > 5) throw new AppError(400, "A date option should be 1–5 days.");
  if (b.dateOptions.some((o) => o.start_date === start && o.end_date === end)) throw new AppError(409, "That option is already there.");
  await store.addDateOptions(b.trip.id, [{ start_date: start, end_date: end, added_by: "coordinator" }]);
  await log(b, `📅 New date option: ${fmtRange(start, end)} — everyone tap yes / no / maybe`, "dates");
  if (b.trip.status !== "collecting") await reconcile(slug, now);
  return { ok: true };
}

export async function removeDateOption(slug: string, optionId: string, now: Date) {
  const b = await load(slug);
  notFrozen(b);
  const o = b.dateOptions.find((x) => x.id === optionId);
  if (!o) throw new AppError(404, "That date option is gone.");
  if (b.dateOptions.length <= 1) throw new AppError(409, "Keep at least one date option.");
  await store.removeDateOption(optionId);
  await log(b, `🗑️ Date option ${fmtRange(o.start_date, o.end_date)} was removed`, "dates");
  if (b.trip.status !== "collecting") await reconcile(slug, now);
  return { ok: true };
}

export async function setDeadline(slug: string, deadline: Date, now: Date) {
  const b = await load(slug);
  notFrozen(b);
  if (b.trip.status !== "collecting") throw new AppError(409, "Plans are already made — the answer deadline no longer matters.");
  if (Number.isNaN(deadline.getTime())) throw new AppError(400, "Pick a date and time.");
  if (deadline.getTime() <= now.getTime()) throw new AppError(400, "The new deadline should be in the future.");
  await store.updateTrip(b.trip.id, { deadline: deadline.toISOString() });
  const later = deadline.getTime() > Date.parse(b.trip.deadline);
  await log(b, `⏰ Deadline ${later ? "extended" : "moved up"} to ${fmtDateTime(deadline.toISOString())} IST`, "deadline");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// 2. The 4 quick steps. Every tap saves; changes after plans exist re-check them.

const VOTE_WORD: Record<DateVoteValue, string> = { yes: "can do", no: "can't do", maybe: "might do" };

export async function voteDate(slug: string, memberId: string, optionId: string, vote: DateVoteValue, knowBy: string | null, now: Date) {
  const b = await load(slug);
  notFrozen(b);
  const m = memberOf(b, memberId);
  const o = b.dateOptions.find((x) => x.id === optionId);
  if (!o) throw new AppError(404, "That date option was removed.");
  if (!["yes", "no", "maybe"].includes(vote)) throw new AppError(400, "Bad vote");
  const chip = KNOW_BY.find((k) => k.key === knowBy) ?? KNOW_BY[1];
  const known_by = vote === "maybe" ? addDays(istDay(now), chip.days) : null;
  const before = b.dateVotes.find((v) => v.option_id === optionId && v.member_id === memberId);
  await store.upsertDateVote(b.trip.id, { option_id: optionId, member_id: memberId, vote, known_by });

  // Only a changed answer from someone who'd already finished is news for the group.
  if (!before || before.vote === vote || !m.submitted_at) return { ok: true };
  const range = fmtRange(o.start_date, o.end_date);
  const summary =
    before.vote === "maybe"
      ? `${m.name}'s maybe for ${range} turned into a ${vote === "yes" ? "YES 🎉" : "no"}`
      : `${m.name} changed ${range}: now ${VOTE_WORD[vote]} it`;
  await log(b, `${b.trip.status === "agreed" ? "After agreeing: " : ""}${summary}`, "edit", memberId);
  if (b.trip.status !== "collecting") await reconcile(slug, now);
  return { ok: true };
}

export async function swipeIdea(slug: string, memberId: string, ideaId: string, liked: boolean) {
  const b = await load(slug);
  notFrozen(b);
  memberOf(b, memberId);
  if (!b.ideas.some((i) => i.id === ideaId)) throw new AppError(404, "Unknown idea");
  await store.upsertIdeaSwipe(b.trip.id, { idea_id: ideaId, member_id: memberId, liked: Boolean(liked) });
  return { ok: true };
}

export async function saveBudget(slug: string, memberId: string, tierKey: string, homeCity: string, now: Date) {
  const b = await load(slug);
  notFrozen(b);
  const m = memberOf(b, memberId);
  const tier = BUDGET_TIERS.find((t) => t.key === tierKey);
  // "keep" = only the home city changed; the budget stays as it was (it's never sent back to the browser).
  if (!tier && !(tierKey === "keep" && m.has_budget)) throw new AppError(400, "Pick a budget.");
  const prefs = b.preferences.find((p) => p.member_id === memberId);
  const city = homeCity.trim().slice(0, 40);
  await store.upsertPreferences(b.trip.id, { member_id: memberId, home_city: city, vetoes: prefs?.vetoes ?? [], veto_notes: prefs?.veto_notes ?? "" });
  if (!tier) return { ok: true };
  await store.setBudget(memberId, tier.min, tier.max);
  if (m.submitted_at && b.trip.status !== "collecting") {
    await log(b, `${m.name} updated their budget (kept private 🔒)`, "edit", memberId);
    await reconcile(slug, now);
  }
  return { ok: true };
}

/** Last step. Also marks the person as done and kicks off planning when everyone's in. */
export async function saveHardPasses(slug: string, memberId: string, picked: string[], notes: string, now: Date) {
  const b = await load(slug);
  notFrozen(b);
  const m = memberOf(b, memberId);
  const cleanNotes = String(notes ?? "").trim().slice(0, 200);
  const known = new Set(VETOES.map((v) => v.key));
  const vetoes = [...new Set([...picked.filter((k) => known.has(k)), ...matchHardPasses(cleanNotes)])];
  const prefs = b.preferences.find((p) => p.member_id === memberId);
  await store.upsertPreferences(b.trip.id, { member_id: memberId, home_city: prefs?.home_city ?? "", vetoes, veto_notes: cleanNotes });

  const firstTime = !m.submitted_at;
  const stamp = new Date().toISOString();
  await store.updateMember(memberId, { submitted_at: m.submitted_at ?? stamp, updated_at: stamp });

  const label = (k: string) => VETO_BY_KEY[k]?.label ?? k;
  const added = vetoes.filter((v) => !prefs?.vetoes.includes(v));
  const removed = (prefs?.vetoes ?? []).filter((v) => !vetoes.includes(v));
  const prefix = b.trip.status === "agreed" ? "After agreeing: " : "";
  if (firstTime) await log(b, `${m.name} is in ✅`, "submitted", memberId);
  else {
    if (added.length) await log(b, `${prefix}${m.name} added hard passes: ${added.map(label).join(", ")}`, "edit", memberId);
    if (removed.length) await log(b, `${prefix}${m.name} dropped hard passes: ${removed.map(label).join(", ")}`, "edit", memberId);
  }

  // Plans are made by the next page load (AutoPlanner shows a loader), not inside this save,
  // so a slow Gemini call can never cut the save short.
  if (b.trip.status !== "collecting" && (firstTime || added.length || removed.length)) await reconcile(slug, now);
  return { ok: true, vetoes };
}

// ---------------------------------------------------------------------------
// 3. Plans

function planContext(b: TripBundle, dates: DatesResult, ceiling: number | null, now: Date): PlanContext {
  const assume = assumeMissing(b, now);
  const ideaName = (id: string) => b.ideas.find((i) => i.id === id)?.destination ?? "";
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
        unsure: w.maybe.map((u) => `${u.name}${u.knownBy ? ` (knows by ${u.knownBy})` : ""}`),
      })),
    ],
    ideaLikes: b.ideas
      .map((i) => ({
        destination: i.destination,
        likes: b.ideaSwipes.filter((s) => s.idea_id === i.id && s.liked).length,
        of: b.ideaSwipes.filter((s) => s.idea_id === i.id).length,
      }))
      .sort((x, y) => y.likes - x.likes),
    people: b.members.map((m) => {
      const p = b.preferences.find((x) => x.member_id === m.id);
      const mine = b.ideaSwipes.filter((s) => s.member_id === m.id);
      return {
        name: m.name,
        homeCity: p?.home_city ?? "",
        likedIdeas: mine.filter((s) => s.liked).map((s) => ideaName(s.idea_id)),
        passedIdeas: mine.filter((s) => !s.liked).map((s) => ideaName(s.idea_id)),
        vetoes: p?.vetoes ?? [],
        vetoNotes: p?.veto_notes ?? "",
        assumed: !m.submitted_at && assume,
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

/** Ask for plans until we have `count` that pass every rule (retries stop early to fit Vercel's time limit). */
async function producePlans(b: TripBundle, dates: DatesResult, count: number, avoid: string[], feedback: string[], now: Date) {
  const ceiling = await store.budgetCeiling(b.trip.id);
  const ctx = planContext(b, dates, ceiling, now);
  const good: PlanDraft[] = [];
  const rejected: { draft: PlanDraft; reason: string }[] = [];
  let source: PlanSource = "sample";
  const started = Date.now();
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

export async function generateInitialPlans(slug: string, now: Date, force = false) {
  const b = await load(slug);
  const dates = datesFor(b, now);
  if (!force && !readyToPlan(b, dates, now)) return { generated: false };
  if (b.members.length < 2) throw new AppError(409, "Add at least one more person first.");
  const missing = b.members.filter((m) => !m.submitted_at);
  if (force && missing.length && !isDeadlinePassed(b, now)) {
    throw new AppError(409, `${missing.map((m) => m.name).join(", ")} still ${missing.length > 1 ? "have" : "has"} to answer — nudge them, or wait for the deadline.`);
  }
  if (dates.full.length + dates.maybe.length === 0) throw new AppError(409, "No date option works for everyone yet — add another date option or nudge people to update.");
  if (!(await store.claimTrip(b.trip.id, { status: "collecting" }, { status: "voting", blend_round: 0 }))) return { generated: false };
  b.trip.status = "voting";
  b.trip.blend_round = 0;
  await log(b, "🧠 Everyone's in — making plans…", "planning");
  try {
    // Planning has started: anyone still missing is now assumed (see assumeMissing).
    const fresh = datesFor(b, now);
    const { good, rejected, source } = await producePlans(b, fresh, 3, [], [], now);
    await store.insertPlans([
      ...rejected.map((r) => newPlan(b, r.draft, { status: "rejected", status_reason: r.reason })),
      ...good.map((d) => newPlan(b, d, {})),
    ]);
    for (const r of rejected) await log(b, `🚫 Code threw out a ${r.draft.destination} plan: ${r.reason}`, "rejected");
    await log(
      b,
      good.length
        ? `✨ ${good.length} trip plan${good.length > 1 ? "s are" : " is"} ready — everyone swipe!${sourceNote(source)}`
        : "😕 No plan passed everyone's hard passes, budgets and dates. Riya can try again.",
      "plans",
    );
    return { generated: true };
  } catch (err) {
    await store.updateTrip(b.trip.id, { status: "collecting" });
    throw err;
  }
}

export async function startPlanning(slug: string, now: Date) {
  const b = await load(slug);
  if (b.trip.status !== "collecting") throw new AppError(409, "Planning has already started.");
  return generateInitialPlans(slug, now, true);
}

/** Riya's "get fresh plans" button: replaces the current round's live plans with 3 new ones. */
export async function freshPlans(slug: string, now: Date) {
  const b = await load(slug);
  if (b.trip.status === "collecting") return startPlanning(slug, now);
  notFrozen(b);
  const dates = datesFor(b, now);
  const current = b.plans.filter((p) => p.status === "active" && p.round === b.trip.blend_round);
  const { good, rejected, source } = await producePlans(b, dates, 3, current.map((p) => p.destination), [], now);
  if (!good.length) throw new AppError(422, "Couldn't find plans that pass everyone's rules. Try adding a date option.");
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
// 4. Something changed after plans exist: re-check, regenerate only the broken ones

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
// 5. Swiping on plans and deciding (no majority rule)

export async function swipe(slug: string, memberId: string, planId: string, decision: "accept" | "decline", reason: string | null, now: Date) {
  const b = await load(slug);
  memberOf(b, memberId);
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
    .sort((a, z) => z.accepted.length - a.accepted.length || (z.plan.created_at ?? "").localeCompare(a.plan.created_at ?? ""));

  if (trip.blend_round >= MAX_BLEND_ROUNDS) {
    if (await store.claimTrip(trip.id, { status: "voting", blend_round: trip.blend_round }, { status: "stuck" })) {
      const top = ranked[0];
      await log(b, `🤝 Still no plan everyone says yes to. Closest: ${top?.plan.destination ?? "—"} (${top?.accepted.length ?? 0}/${members.length} yes). Riya's dashboard shows who's unhappy and why.`, "stuck");
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
    await log(b, `🧪 Split vote (${split}). Here's ONE blended plan with the most-liked bits of each side: ${plan.destination} — everyone swipe on it!${sourceNote(source)}`, "blend");
    return { outcome: "blend" };
  }
  await store.updateTrip(trip.id, { status: "stuck" });
  await log(b, "😕 Couldn't build a blend that respects everyone's hard passes and budgets. Riya's dashboard has the closest plan.", "stuck");
  return { outcome: "stuck" };
}

// ---------------------------------------------------------------------------
// 6. Two-step lock

export async function setConfirmed(slug: string, memberId: string, confirmed: boolean) {
  const b = await load(slug);
  const m = memberOf(b, memberId);
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
// 7. On-load housekeeping: announce "assumed" people once the deadline passes.

export async function housekeeping(slug: string, now: Date) {
  const b = await load(slug);

  // Plan-making was cut off (e.g. a serverless timeout) and left the trip with no plans: undo so it retries.
  if (b.trip.status === "voting" && b.plans.length === 0) {
    const started = b.changes.find((c) => c.kind === "planning")?.created_at;
    if (!started || Date.now() - Date.parse(started) > 90_000) {
      if (await store.claimTrip(b.trip.id, { status: "voting", blend_round: 0 }, { status: "collecting" })) {
        await log(b, "↻ Plan-making got interrupted — trying again", "planning");
      }
    }
  }

  if (!isDeadlinePassed(b, now)) return;
  for (const m of b.members.filter((x) => !x.submitted_at)) {
    if (b.changes.some((c) => c.kind === "assumed" && c.member_id === m.id)) continue;
    await log(b, `⏰ ${m.name} didn't answer by the deadline, so we're counting them in for every date option, with no hard passes and an average budget.`, "assumed", m.id);
  }
}
