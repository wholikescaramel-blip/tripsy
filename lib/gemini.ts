// All Gemini calls live here. Without GEMINI_API_KEY (or if Gemini errors) we fall back to
// realistic sample plans so the whole app works offline.

import "server-only";
import { ACTIVITY_BY_KEY, VETOES, VETO_BY_KEY, VIBE_BY_KEY } from "./options";
import type { PlanContext, VoteSummary } from "./plan-context";
import type { PlanDraft } from "./types";
import { sampleBlend, samplePlans } from "./sample-plans";
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
  required: ["destination", "region", "summary", "start_date", "end_date", "activities", "travel", "stay", "cost_per_person", "fit_notes", "tags"],
};

const SYSTEM = `You plan short group trips in India for a group of friends who live in different cities.
Hard rules (a plan that breaks any of them is thrown away by code, so don't waste it):
- Dates: a 2–4 day trip fully inside one of the given date windows. Prefer "everyone_free" windows.
- Hard no's are absolute. Never include anything on anyone's hard-no list — not the destination, travel mode, stay, or any activity. Don't mention vetoed things at all, not even to say they're avoided.
- Keep cost_per_person (rough INR, including travel from their home cities) at or under the per-person ceiling if one is given. Never mention budgets, money limits or anyone's finances in fit_notes.
- "tags" must list every hard-no key from the reference list that the plan touches, honestly.
- fit_notes: exactly one short, warm line per person (use their name as given) on how the plan fits what THEY asked for.
- Rough estimates only; no live prices, bookings, or links.`;

function describe(ctx: PlanContext): string {
  const people = ctx.people.map((p) => ({
    name: p.name,
    home_city: p.homeCity || "unknown",
    trip_vibes: p.vibes.map((k) => VIBE_BY_KEY[k]?.label ?? k),
    wants_to_do: p.activities.map((k) => ACTIVITY_BY_KEY[k]?.label ?? k),
    hard_no: p.vetoes.map((k) => `${k} (${VETO_BY_KEY[k]?.label ?? k})`),
    other_hard_no: p.vetoNotes || undefined,
    wishes: p.wishes || undefined,
    note: p.assumed ? "Missed the deadline: assume free every day, no hard no's, easy-going." : undefined,
  }));
  return JSON.stringify(
    {
      trip: ctx.tripName,
      month: fmtMonth(ctx.month),
      date_windows: ctx.windows,
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

type RawPlan = Omit<PlanDraft, "fit_notes"> & { fit_notes: { name: string; line: string }[] };

function normalise(raw: RawPlan): PlanDraft {
  return {
    ...raw,
    cost_per_person: Math.round(Number(raw.cost_per_person) || 0),
    activities: (raw.activities ?? []).map((a) => ({ day: a.day, title: String(a.title) })),
    fit_notes: Object.fromEntries((raw.fit_notes ?? []).map((f) => [f.name, f.line])),
    tags: (raw.tags ?? []).filter((t) => VETO_BY_KEY[t]),
  };
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
    return { plans: out.plans.slice(0, count).map(normalise), source: "gemini" };
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
  const prompt = `The group is split — no plan was accepted by everyone. This is blend round ${round} of 2.
Create ONE blended plan that combines the most-liked parts of each side so everyone gets something they want.
Look at who accepted and declined each plan (and why) and fix those reasons. It can be a new destination if that serves both sides better.
${feedback.length ? `Earlier attempts were rejected by the rule checker for: ${feedback.join(" | ")}.` : ""}
Vote results:
${JSON.stringify(summary, null, 1)}
Group details:
${describe(ctx)}`;
  try {
    const out = (await callGemini(prompt, PLAN_SCHEMA)) as RawPlan;
    return { plan: normalise(out), source: "gemini" };
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
