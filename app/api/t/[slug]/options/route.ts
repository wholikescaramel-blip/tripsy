import { handle, requireAdmin } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { AppError, addDateOption, load, removeDateOption } from "@/lib/service";

export const maxDuration = 60;

/** Riya adds or removes a date option. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/options">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await req.json();
    const b = await load(slug);
    requireAdmin(b.trip.admin_key, body.adminKey);
    const now = await nowFor(b.trip);
    if (body.action === "add") return addDateOption(slug, String(body.start ?? ""), String(body.end ?? ""), now);
    if (body.action === "remove") return removeDateOption(slug, String(body.optionId), now);
    throw new AppError(400, "Unknown action");
  });
}
