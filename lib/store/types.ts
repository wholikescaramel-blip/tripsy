import type { ChangeEntry, DateOption, DateVote, IdeaDraft, IdeaSwipe, Member, NudgeLog, Plan, Preferences, Swipe, Trip, TripBundle } from "../types";

export interface NewTripInput {
  slug: string;
  admin_key: string;
  name: string;
  target_month: string;
  deadline: string;
  is_demo: boolean;
  members: { name: string; phone: string; is_coordinator: boolean }[];
}

export type NewPlan = Omit<Plan, "id" | "created_at">;

/**
 * Data access. Two implementations: Supabase (when keys are set) and an in-memory
 * store so the app runs locally with zero setup. Budgets are write-only: callers can
 * only ask "does this cost fit each person?", never read the numbers back.
 */
export interface Store {
  readonly kind: "supabase" | "memory";
  getBundle(slug: string): Promise<TripBundle | null>;
  createTrip(input: NewTripInput): Promise<TripBundle>;
  deleteTrip(tripId: string): Promise<void>;
  updateTrip(tripId: string, patch: Partial<Trip>): Promise<void>;
  /** Atomically apply `patch` only if the trip still matches `expect`. Returns false if someone else got there first. */
  claimTrip(tripId: string, expect: Partial<Trip>, patch: Partial<Trip>): Promise<boolean>;

  addMember(tripId: string, m: { name: string; phone: string }): Promise<Member>;
  removeMember(memberId: string): Promise<void>;
  updateMember(memberId: string, patch: Partial<Member>): Promise<void>;

  addDateOptions(tripId: string, options: Pick<DateOption, "start_date" | "end_date" | "added_by">[]): Promise<void>;
  removeDateOption(optionId: string): Promise<void>;
  upsertDateVote(tripId: string, vote: Omit<DateVote, "updated_at">): Promise<void>;

  insertIdeas(tripId: string, ideas: IdeaDraft[]): Promise<void>;
  upsertIdeaSwipe(tripId: string, swipe: IdeaSwipe): Promise<void>;

  upsertPreferences(tripId: string, prefs: Preferences): Promise<void>;
  setBudget(memberId: string, min: number, max: number): Promise<void>;
  /** For each cost, memberId -> fits. Members without a budget use the average of the others. */
  budgetFits(tripId: string, costs: number[]): Promise<Record<string, boolean>[]>;
  /** Lowest per-person max across the group (nobody's identity attached). Null if no budgets yet. */
  budgetCeiling(tripId: string): Promise<number | null>;

  insertPlans(plans: NewPlan[]): Promise<Plan[]>;
  updatePlan(planId: string, patch: Partial<Plan>): Promise<void>;
  upsertSwipe(tripId: string, swipe: Omit<Swipe, "updated_at">): Promise<void>;
  addChange(entry: Omit<ChangeEntry, "id" | "created_at">): Promise<void>;
  logNudge(n: Omit<NudgeLog, "sent_at">): Promise<void>;
}
