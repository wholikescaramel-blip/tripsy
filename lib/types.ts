// Shared data types. Row shapes mirror supabase/schema.sql.

export type DayStatus = "free" | "busy" | "maybe";

export type TripStatus = "collecting" | "voting" | "agreed" | "confirmed" | "stuck";

export interface Trip {
  id: string;
  slug: string;
  admin_key: string;
  name: string;
  target_month: string; // YYYY-MM-01
  deadline: string; // ISO timestamp
  status: TripStatus;
  blend_round: number; // 0 = initial plans, 1..2 = blend rounds
  agreed_plan_id: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface Member {
  id: string;
  trip_id: string;
  name: string;
  phone: string;
  is_coordinator: boolean;
  sort_order: number;
  has_budget: boolean;
  submitted_at: string | null;
  updated_at: string | null;
  confirmed_at: string | null;
}

export interface AvailabilityRow {
  member_id: string;
  day: string; // YYYY-MM-DD
  status: DayStatus;
  maybe_known_by: string | null; // YYYY-MM-DD
}

export interface Preferences {
  member_id: string;
  home_city: string;
  vibes: string[];
  activities: string[];
  vetoes: string[];
  veto_notes: string;
  wishes: string;
}

export interface PlanActivity {
  title: string;
  day?: number;
}

export type PlanStatus = "active" | "broken" | "rejected" | "superseded" | "agreed";

export interface Plan {
  id: string;
  trip_id: string;
  round: number;
  kind: "initial" | "blend" | "replacement";
  source_plan_ids: string[];
  replaces_plan_id: string | null;
  destination: string;
  region: string;
  summary: string;
  start_date: string;
  end_date: string;
  activities: PlanActivity[];
  travel: string;
  stay: string;
  cost_per_person: number;
  fit_notes: Record<string, string>; // member name -> line
  tags: string[];
  status: PlanStatus;
  status_reason: string | null;
  created_at: string;
}

export interface Swipe {
  plan_id: string;
  member_id: string;
  decision: "accept" | "decline";
  reason: string | null;
  updated_at: string;
}

export interface ChangeEntry {
  id: string;
  trip_id: string;
  member_id: string | null;
  kind: string;
  summary: string;
  created_at: string;
}

export interface NudgeLog {
  trip_id: string;
  member_id: string;
  nudge_kind: string;
  sent_at: string;
}

/** Everything about a trip except budgets (which never leave the database). */
export interface TripBundle {
  trip: Trip;
  members: Member[];
  availability: AvailabilityRow[];
  preferences: Preferences[];
  plans: Plan[];
  swipes: Swipe[];
  changes: ChangeEntry[];
  nudges: NudgeLog[];
}

/** Draft of a plan as produced by Gemini (or the sample generator). */
export interface PlanDraft {
  destination: string;
  region: string;
  summary: string;
  start_date: string;
  end_date: string;
  activities: PlanActivity[];
  travel: string;
  stay: string;
  cost_per_person: number;
  fit_notes: Record<string, string>;
  tags: string[];
}
