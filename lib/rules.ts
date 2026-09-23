// Hard rules every plan must pass. Vetoes are absolute: no score, vote or blend overrides them.

import { VETOES, VETO_BY_KEY } from "./options";
import { blockersFor, fitsInWindows, type DatesResult } from "./dates";
import type { Member, PlanDraft, Preferences } from "./types";
import { fmtDay } from "./time";

export interface RuleResult {
  ok: boolean;
  problems: string[];
  /** Plan dates rely on someone's "maybe" days. Allowed, but shown on the card. */
  dependsOnMaybe: string[];
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function mentions(text: string, phrase: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${escapeRe(phrase.toLowerCase().trim())}`, "i").test(text);
}

/** Turn "no seafood, nothing before 8am" into ["seafood", "nothing before 8am"]. */
export function vetoPhrases(notes: string): string[] {
  return notes
    .split(/[,;\n]| and /i)
    .map((p) => p.trim().replace(/^(no|not|never|avoid|don't want|dont want|nothing with)\s+/i, "").trim())
    .filter((p) => p.length >= 3);
}

export function planText(plan: PlanDraft) {
  const acts = plan.activities.map((a) => a.title).join(" · ");
  return {
    travel: `${plan.travel} ${acts}`.toLowerCase(),
    place: `${plan.destination} ${plan.region} ${acts} ${plan.stay}`.toLowerCase(),
  };
}

/** Which of this member's vetoes does the plan break? Pure keyword + tag check. */
export function vetoHits(plan: PlanDraft, prefs: Preferences | undefined): string[] {
  if (!prefs) return [];
  const text = planText(plan);
  const hits: string[] = [];
  for (const key of prefs.vetoes) {
    const v = VETO_BY_KEY[key];
    if (!v) continue;
    const scope = v.group === "Getting there" ? text.travel : text.place;
    if (plan.tags.includes(key) || v.keywords.some((k) => mentions(scope, k))) hits.push(v.label);
  }
  const all = `${text.travel} ${text.place}`;
  for (const phrase of vetoPhrases(prefs.veto_notes ?? "")) {
    if (mentions(all, phrase)) hits.push(`"${phrase}"`);
  }
  return hits;
}

export function checkPlan(
  plan: PlanDraft,
  members: Member[],
  prefs: Preferences[],
  dates: DatesResult,
  budgetFits: Record<string, boolean>, // memberId -> fits
): RuleResult {
  const problems: string[] = [];
  const dependsOnMaybe: string[] = [];

  // 1. Vetoes. People who never submitted have no vetoes on record.
  for (const m of members) {
    const hits = vetoHits(plan, prefs.find((p) => p.member_id === m.id && m.submitted_at));
    if (hits.length) problems.push(`Breaks ${m.name}'s hard no: ${hits.join(", ")}`);
  }

  // 2. Budget. Only a yes/no per person ever leaves the database.
  const over = members.filter((m) => budgetFits[m.id] === false);
  if (over.length) problems.push(`Over budget for ${over.map((m) => m.name).join(", ")}`);

  // 3. Dates must sit inside a window everyone can make (or can make if their "maybe" turns into a yes).
  if (!fitsInWindows(plan.start_date, plan.end_date, dates.full)) {
    const inMaybe = fitsInWindows(plan.start_date, plan.end_date, dates.maybe);
    if (inMaybe) {
      for (const u of inMaybe.unsure) {
        if (u.days.some((d) => d >= plan.start_date && d <= plan.end_date)) dependsOnMaybe.push(u.name);
      }
    } else {
      const blockers = blockersFor(plan.start_date, plan.end_date, members, dates.grid);
      const names = [...new Set(blockers.map((b) => b.name))];
      problems.push(
        names.length
          ? `Dates no longer work for ${names.join(", ")} (${fmtDay(blockers[0].day)})`
          : "Dates must be a 2–4 day window inside the target month",
      );
    }
  }

  return { ok: problems.length === 0, problems, dependsOnMaybe };
}

export const VETO_KEYS = VETOES.map((v) => v.key);
