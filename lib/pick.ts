// Final pick: when more than one plan gets a yes from everyone, each person taps a favourite.
// A pick is stored as the reason on that person's "accept" swipe, so no extra table is needed.
import type { Plan, TripBundle } from "./types";

type Votes = Pick<TripBundle, "trip" | "members" | "plans" | "swipes">;

export const PICK_MARK = "★ top pick";

export function isPick(s: { decision: string; reason: string | null }) {
  return s.decision === "accept" && s.reason === PICK_MARK;
}

/** Everyone has swiped on every plan of the current round. */
export function allSwiped(b: Votes) {
  const current = b.plans.filter((p) => p.status === "active" && p.round === b.trip.blend_round);
  return current.length > 0 && b.members.every((m) => current.every((p) => b.swipes.some((s) => s.plan_id === p.id && s.member_id === m.id)));
}

/** Plans everyone said yes to. Only counted once voting is finished, so nobody gets cut off mid-swipe. */
export function finalists(b: Votes): Plan[] {
  if (b.trip.status === "voting" && !allSwiped(b)) return [];
  const accepts = (p: Plan) => b.members.every((m) => b.swipes.some((s) => s.plan_id === p.id && s.member_id === m.id && s.decision === "accept"));
  return b.plans.filter((p) => p.status === "active" && accepts(p));
}

/** memberId -> the finalist they picked (ignores picks on plans that dropped out). */
export function picks(b: Votes, plans: Plan[]): Record<string, string> {
  const ids = new Set(plans.map((p) => p.id));
  return Object.fromEntries(b.swipes.filter((s) => isPick(s) && ids.has(s.plan_id)).map((s) => [s.member_id, s.plan_id]));
}

/** Most picks wins. Tie: cheaper per person, then the older plan. */
export function pickWinner(plans: Plan[], chosen: Record<string, string>): Plan {
  const count = (p: Plan) => Object.values(chosen).filter((id) => id === p.id).length;
  return [...plans].sort((a, z) => count(z) - count(a) || a.cost_per_person - z.cost_per_person || a.created_at.localeCompare(z.created_at))[0];
}
