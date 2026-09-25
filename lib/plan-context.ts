// What gets sent to the plan generator (Gemini or the offline sample generator).
// Budgets are NOT in here per person — only the group's lowest ceiling, with no name attached.

import type { PlanDraft } from "./types";

export interface PersonContext {
  name: string;
  homeCity: string;
  likedIdeas: string[]; // destination names they swiped right on
  passedIdeas: string[]; // swiped left
  vetoes: string[]; // hard-pass keys (absolute)
  vetoNotes: string; // typed hard passes
  assumed: boolean; // hasn't answered: counted free on every option, no hard passes, average budget
}

export interface WindowContext {
  start: string;
  end: string;
  kind: "everyone_free" | "depends_on_maybe";
  unsure: string[];
}

export interface PlanContext {
  tripName: string;
  month: string; // YYYY-MM-01
  windows: WindowContext[]; // the date options that work
  people: PersonContext[];
  ideaLikes: { destination: string; likes: number; of: number }[];
  budgetCeiling: number | null; // per person, INR
}

export interface VoteSummary {
  plan: PlanDraft & { id?: string; created_at?: string };
  accepted: string[];
  declined: { name: string; reason: string | null }[];
}
