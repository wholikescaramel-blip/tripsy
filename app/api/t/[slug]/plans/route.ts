import { handle, requireAdmin } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { freshPlans, generateInitialPlans, load, lockPlan, reopenVote, startPlanning } from "@/lib/service";

export const maxDuration = 60;

/** mode "auto": anyone's page can kick this off once everyone's in (no-op otherwise).
 *  mode "start": Riya says everyone's here — plan now.
 *  mode "fresh": Riya asks for 3 new plans (works even after locking).
 *  mode "reopen": Riya unlocks the agreed plan.  mode "lock": Riya locks any plan directly. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/plans">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await req.json().catch(() => ({}));
    const b = await load(slug);
    const now = await nowFor(b.trip);
    if (body.mode === "start") {
      requireAdmin(b.trip.admin_key, body.adminKey);
      return startPlanning(slug, now);
    }
    if (body.mode === "fresh") {
      requireAdmin(b.trip.admin_key, body.adminKey);
      return freshPlans(slug, now);
    }
    if (body.mode === "reopen" || body.mode === "lock") {
      requireAdmin(b.trip.admin_key, body.adminKey);
      return body.mode === "reopen" ? reopenVote(slug) : lockPlan(slug, String(body.planId));
    }
    return generateInitialPlans(slug, now);
  });
}
