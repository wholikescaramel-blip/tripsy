// All Gemini calls live here. Without GEMINI_API_KEY (or if Gemini errors) we fall back to
// realistic sample plans so the whole app works offline.

import "server-only";
import { VETOES, VETO_BY_KEY } from "./options";
import type { PlanContext, VoteSummary } from "./plan-context";
import type { IdeaDraft, PlanDraft } from "./types";
import { sampleBlend, sampleIdeas, samplePlans } from "./sample-plans";
import { fmtMonth } from "./time";

const API = "https://generativelanguage.googleapis.com/v1beta/models";
// Flash for quality; Flash-Lite as a fallback because its free-tier limits are higher.
const MODELS = [...new Set([process.env.GEMINI_MODEL || "gemini-3.6-flash", "gemini-3.5-flash-lite"])];

export type PlanSource = "gemini" | "sample";

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const PLAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    destination: { type: "STRING" },
    region: { type: "STRING" },
    summary: { type: "STRING", description: "One enticing sentence." },
    start_date: { type: "STRING", description: "YYYY-MM-DD" },
    end_date: { type: "STRING", description: "YYYY-MM-DD" },
    activities: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { day: { type: "INTEGER" }, title: { type: "STRING" } },
        required: ["day", "title"],
      },
    },
    things_to_do: {
      type: "ARRAY",
      description: "6-8 curated extra things to do in this place (must-try food, hidden gems, experiences, day trips) — beyond the day plan. Same hard-no rules apply.",
      items: { type: "STRING" },
    },
    travel: { type: "STRING", description: "How people get there from their home cities." },
    stay: { type: "STRING" },
    cost_per_person: { type: "INTEGER", description: "Rough INR per person incl. travel, stay, food, activities." },
    fit_notes: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { name: { type: "STRING" }, line: { type: "STRING" } },
        required: ["name", "line"],
      },
    },
    tags: {
      type: "ARRAY",
      description: "Every hard-no key from the list that this plan involves in ANY way.",
      items: { type: "STRING", enum: VETOES.map((v) => v.key) },
    },
  },
  required: ["destination", "region", "summary", "start_date", "end_date", "activities", "things_to_do", "travel", "stay", "cost_per_person", "fit_notes", "tags"],
};

const SYSTEM = `You plan short group trips in India for a group of friends who live in different cities.
Hard rules (a plan that breaks any of them is thrown away by code, so don't waste it):
- Dates: start_date and end_date must be EXACTLY one of the given date_options (same start, same end). Prefer "everyone_free" ones.
- Hard no's are absolute. Never include anything on anyone's hard-no list — not the destination, travel mode, stay, or any activity. Don't mention vetoed things at all, not even to say they're avoided.
- Keep cost_per_person (rough INR, including travel from their home cities) at or under the per-person ceiling if one is given. Never mention budgets, money limits or anyone's finances in fit_notes.
- "tags" must list every hard-no key from the reference list that the plan touches, honestly.
- fit_notes: exactly one short, warm line per person (use their name as given) on how the plan fits what THEY liked. Build plans around the destination ideas the group swiped right on most.
- Rough estimates only; no live prices, bookings, or links.`;

function describe(ctx: PlanContext): string {
  const people = ctx.people.map((p) => ({
    name: p.name,
    home_city: p.homeCity || "unknown",
    liked_ideas: p.likedIdeas,
    passed_on_ideas: p.passedIdeas,
    hard_no: p.vetoes.map((k) => `${k} (${VETO_BY_KEY[k]?.label ?? k})`),
    other_hard_no: p.vetoNotes || undefined,
    note: p.assumed ? "Hasn't answered: assume free on every date option, no hard no's, easy-going." : undefined,
  }));
  return JSON.stringify(
    {
      trip: ctx.tripName,
      month: fmtMonth(ctx.month),
      date_options: ctx.windows,
      idea_likes: ctx.ideaLikes,
      per_person_cost_ceiling_inr: ctx.budgetCeiling,
      people,
      hard_no_reference: VETOES.map((v) => `${v.key}: ${v.label}`),
    },
    null,
    1,
  );
}

async function callGemini(prompt: string, schema: object): Promise<unknown> {
  const key = process.env.GEMINI_API_KEY!;
  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: schema,
            temperature: 0.9,
            // Low thinking keeps each call to a few seconds, well inside Vercel's 60s function limit.
            thinkingConfig: { thinkingLevel: "low" },
          },
        }),
        signal: AbortSignal.timeout(22_000),
      });
      if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
      const json = await res.json();
      const text = (json.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
      return JSON.parse(text);
    } catch (err) {
      lastErr = err;
      console.warn("[gemini] falling back:", err instanceof Error ? err.message : err);
    }
  }
  throw lastErr;
}

type RawPlan = Omit<PlanDraft, "fit_notes"> & { fit_notes: { name: string; line: string }[]; things_to_do?: string[] };

function normalise(raw: RawPlan): PlanDraft {
  const { things_to_do, ...plan } = raw; // things_to_do is folded into activities (day 0), not a column
  return {
    ...plan,
    cost_per_person: Math.round(Number(raw.cost_per_person) || 0),
    activities: [
      ...(raw.activities ?? []).map((a) => ({ day: Math.max(1, Number(a.day) || 1), title: String(a.title) })),
      // Curated extras ride along as day 0, so the hard-pass checker scans them too.
      ...(things_to_do ?? []).slice(0, 8).map((t) => ({ day: 0, title: String(t) })),
    ],
    fit_notes: Object.fromEntries((raw.fit_notes ?? []).map((f) => [f.name, f.line])),
    tags: (raw.tags ?? []).filter((t) => VETO_BY_KEY[t]),
  };
}

const PLAN_FIELDS = ["destination", "region", "summary", "start_date", "end_date", "activities", "travel", "stay", "cost_per_person", "fit_notes", "tags"] as const;
function pickPlan(p: PlanDraft): PlanDraft {
  return Object.fromEntries(PLAN_FIELDS.map((k) => [k, p[k]])) as unknown as PlanDraft;
}

const IDEA_SCHEMA = {
  type: "OBJECT",
  properties: {
    ideas: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          destination: { type: "STRING" },
          region: { type: "STRING" },
          pitch: { type: "STRING", description: "One short, fun line (max 10 words)." },
          highlights: { type: "ARRAY", items: { type: "STRING" }, description: "3 short things to do there." },
          emoji: { type: "STRING", description: "One emoji." },
          cost_estimate: { type: "INTEGER", description: "Rough INR per person for 3 days incl. travel." },
          tags: { type: "ARRAY", items: { type: "STRING", enum: VETOES.map((v) => v.key) }, description: "Every hard-no key this trip involves." },
        },
        required: ["destination", "region", "pitch", "highlights", "emoji", "cost_estimate", "tags"],
      },
    },
  },
  required: ["ideas"],
};

/** Destination idea cards people swipe on first (so nobody fills in a "what do you like" form). */
export async function generateIdeas(month: string, count = 8, avoid: string[] = []): Promise<{ ideas: IdeaDraft[]; source: PlanSource }> {
  if (!geminiConfigured()) return { ideas: sampleIdeas(count, avoid), source: "sample" };
  const prompt = `Suggest ${count} very different 2–4 day group trip ideas in India that are good in ${fmtMonth(month)} (think about the weather that month).
Mix styles: beach, hills, heritage, backwaters/nature, adventure, city/food, wildlife, a chill villa weekend. Keep it realistic for friends travelling from different Indian cities.
${avoid.length ? `Someone passed on all of these, so suggest different places and styles: ${avoid.join(", ")}.` : ""}`;
  try {
    const out = (await callGemini(prompt, IDEA_SCHEMA)) as { ideas: IdeaDraft[] };
    const ideas = out.ideas.slice(0, count).map((i) => ({
      ...i,
      cost_estimate: Math.round(Number(i.cost_estimate) || 0),
      highlights: (i.highlights ?? []).slice(0, 3).map(String),
      tags: (i.tags ?? []).filter((t) => VETO_BY_KEY[t]),
    }));
    const min = Math.min(4, count);
    return ideas.length >= min ? { ideas, source: "gemini" } : { ideas: sampleIdeas(count, avoid), source: "sample" };
  } catch {
    return { ideas: sampleIdeas(count, avoid), source: "sample" };
  }
}

/**
 * Generate `count` fresh plans. `avoid` lists destinations already on the table;
 * `feedback` explains why earlier attempts were thrown out.
 */
export async function generatePlans(
  ctx: PlanContext,
  count: number,
  avoid: string[] = [],
  feedback: string[] = [],
): Promise<{ plans: PlanDraft[]; source: PlanSource }> {
  if (!geminiConfigured()) return { plans: samplePlans(ctx, count, avoid), source: "sample" };
  const prompt = `Create ${count} different trip plan${count > 1 ? "s" : ""} for this group. Make them genuinely different from each other (different destinations and styles).
${avoid.length ? `Don't use these destinations (already suggested): ${avoid.join(", ")}.` : ""}
${feedback.length ? `Earlier attempts were rejected by the rule checker for: ${feedback.join(" | ")}. Avoid those mistakes.` : ""}
Group details:
${describe(ctx)}`;
  try {
    const out = (await callGemini(prompt, {
      type: "OBJECT",
      properties: { plans: { type: "ARRAY", items: PLAN_SCHEMA } },
      required: ["plans"],
    })) as { plans: RawPlan[] };
    return { plans: out.plans.slice(0, count).map(normalise).map(pickPlan), source: "gemini" };
  } catch {
    return { plans: samplePlans(ctx, count, avoid), source: "sample" };
  }
}

/** Create ONE blended plan from a split vote, combining the most-liked parts of each side. */
export async function blendPlans(
  ctx: PlanContext,
  votes: VoteSummary[],
  round: number,
  avoid: string[] = [],
  feedback: string[] = [],
): Promise<{ plan: PlanDraft | null; source: PlanSource }> {
  if (!geminiConfigured()) return { plan: sampleBlend(ctx, votes, avoid), source: "sample" };
  const summary = votes.map((v) => ({
    destination: v.plan.destination,
    dates: `${v.plan.start_date} to ${v.plan.end_date}`,
    activities: v.plan.activities.map((a) => a.title),
    travel: v.plan.travel,
    cost_per_person: v.plan.cost_per_person,
    accepted_by: v.accepted,
    declined_by: v.declined.map((d) => (d.reason ? `${d.name} (${d.reason})` : d.name)),
  }));
  const prompt = `The group is split between these plans (see who accepted, declined or picked which, and why). This is the one blend round (round ${round}).
Create ONE blended plan that combines the most-liked parts of each side so everyone gets something they want.
Look at who accepted and declined each plan (and why) and fix those reasons. It can be a new destination if that serves both sides better.
${feedback.length ? `Earlier attempts were rejected by the rule checker for: ${feedback.join(" | ")}.` : ""}
Vote results:
${JSON.stringify(summary, null, 1)}
Group details:
${describe(ctx)}`;
  try {
    const out = (await callGemini(prompt, PLAN_SCHEMA)) as RawPlan;
    return { plan: pickPlan(normalise(out)), source: "gemini" };
  } catch {
    return { plan: sampleBlend(ctx, votes, avoid), source: "sample" };
  }
}

/** Tiny request used by /status to check the key and model work. */
export async function pingGemini(): Promise<{ ok: boolean; model?: string; error?: string }> {
  if (!geminiConfigured()) return { ok: false, error: "GEMINI_API_KEY is not set (the app uses sample plans)." };
  const errors: string[] = [];
  for (const model of MODELS) {
    try {
      const res = await fetch(`${API}/${model}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: "Reply with: ok" }] }], generationConfig: { thinkingConfig: { thinkingLevel: "low" } } }),
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return { ok: true, model };
      const body = await res.json().catch(() => ({}));
      errors.push(`${model}: HTTP ${res.status} ${body?.error?.message ?? ""}`.trim());
    } catch (err) {
      errors.push(`${model}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { ok: false, error: errors.join(" · ") };
}
