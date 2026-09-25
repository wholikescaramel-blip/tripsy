// Hard rules every plan must pass. Hard passes are absolute: no vote or blend overrides them.

import { VETO_BY_KEY } from "./options";
import { optionFor, type DatesResult } from "./dates";
import type { Member, PlanDraft, Preferences } from "./types";
import { fmtRange } from "./time";

export interface RuleResult {
  ok: boolean;
  problems: string[];
  /** Plan dates rely on someone's "maybe". Allowed, but shown on the card. */
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
    .map((p) => p.trim().replace(/^(no|not|never|avoid|don't want|dont want|nothing with|hate)\s+/i, "").trim())
    .filter((p) => p.length >= 3);
}

export function planText(plan: PlanDraft) {
  const acts = plan.activities.map((a) => a.title).join(" · ");
  return {
    travel: `${plan.travel} ${acts}`.toLowerCase(),
    place: `${plan.destination} ${plan.region} ${acts} ${plan.stay}`.toLowerCase(),
  };
}

/** Which of this person's hard passes does the plan break? Tag + keyword check. */
export function vetoHits(plan: PlanDraft, prefs: Pick<Preferences, "vetoes" | "veto_notes"> | undefined): string[] {
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

  // 1. Hard passes. People who never answered have none on record.
  for (const m of members) {
    const hits = vetoHits(plan, prefs.find((p) => p.member_id === m.id));
    if (hits.length) problems.push(`Breaks ${m.name}'s hard pass: ${hits.join(", ")}`);
  }

  // 2. Budget. Only a yes/no per person ever leaves the database.
  const over = members.filter((m) => budgetFits[m.id] === false);
  if (over.length) problems.push(`Over budget for ${over.map((m) => m.name).join(", ")}`);

  // 3. Dates must be one of the voted options that works for everyone (or will, if the maybes say yes).
  const option = optionFor(plan.start_date, plan.end_date, dates.options);
  if (!option) problems.push("Dates aren't one of the date options");
  else if (option.works === "no") {
    const who = [...option.no, ...option.pending];
    problems.push(`${fmtRange(option.start, option.end)} no longer works for ${who.join(", ")}`);
  } else if (option.works === "maybe") dependsOnMaybe.push(...option.maybe.map((m) => m.name));

  return { ok: problems.length === 0, problems, dependsOnMaybe };
}
