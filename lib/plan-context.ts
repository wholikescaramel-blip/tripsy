// What gets sent to the plan generator (Gemini or the offline sample generator).
// Budgets are NOT in here per person — only the group's lowest ceiling, with no name attached.

import type { PlanDraft } from "./types";

export interface PersonContext {
  name: string;
  homeCity: string;
  vibes: string[]; // option keys
  activities: string[]; // option keys
  vetoes: string[]; // veto keys (absolute)
  vetoNotes: string;
  wishes: string;
  assumed: boolean; // missed the deadline: free every day, no vetoes, average budget
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
  windows: WindowContext[];
  people: PersonContext[];
  budgetCeiling: number | null; // per person, INR
}

export interface VoteSummary {
  plan: PlanDraft & { id?: string; created_at?: string };
  accepted: string[];
  declined: { name: string; reason: string | null }[];
}
