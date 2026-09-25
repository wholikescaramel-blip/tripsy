// Shared data types. Row shapes mirror supabase/schema.sql.

export type TripStatus = "collecting" | "voting" | "agreed" | "confirmed" | "stuck";

export interface Trip {
  id: string;
  slug: string;
  admin_key: string;
  name: string;
  target_month: string; // YYYY-MM-01
  deadline: string; // ISO timestamp
  status: TripStatus;
  blend_round: number; // 0 = first plans, 1 = the blend
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
  submitted_at: string | null; // finished all 4 quick steps
  updated_at: string | null;
  confirmed_at: string | null;
}

/** A date range people vote on (the app suggests weekends; Riya can add her own). */
export interface DateOption {
  id: string;
  trip_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;
  added_by: "app" | "coordinator";
  created_at: string;
}

export type DateVoteValue = "yes" | "no" | "maybe";

export interface DateVote {
  option_id: string;
  member_id: string;
  vote: DateVoteValue;
  known_by: string | null; // YYYY-MM-DD, only for "maybe"
  updated_at: string;
}

/** A destination idea card people swipe on before any plan exists. */
export interface Idea {
  id: string;
  trip_id: string;
  destination: string;
  region: string;
  pitch: string;
  highlights: string[];
  emoji: string;
  cost_estimate: number; // rough INR per person
  tags: string[]; // hard-pass keys this idea involves
  sort_order: number;
}

export interface IdeaSwipe {
  idea_id: string;
  member_id: string;
  liked: boolean;
}

export interface Preferences {
  member_id: string;
  home_city: string;
  vetoes: string[]; // hard-pass keys
  veto_notes: string; // "type your own"
}

export interface PlanActivity {
  title: string;
  /** 1..n = the day-by-day plan; 0 = "more things to do there" (curated extras). */
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
  dateOptions: DateOption[];
  dateVotes: DateVote[];
  ideas: Idea[];
  ideaSwipes: IdeaSwipe[];
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

export type IdeaDraft = Omit<Idea, "id" | "trip_id" | "sort_order">;
