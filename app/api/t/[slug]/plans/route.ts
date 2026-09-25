import { handle, requireAdmin } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { freshPlans, generateInitialPlans, load, startPlanning } from "@/lib/service";

export const maxDuration = 60;

/** mode "auto": anyone's page can kick this off once everyone's in (no-op otherwise).
 *  mode "start": Riya says everyone's here — plan now.
 *  mode "fresh": Riya asks for 3 new plans. */
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
    return generateInitialPlans(slug, now);
  });
}
