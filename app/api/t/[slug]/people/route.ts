import { handle, requireAdmin } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { AppError, addPerson, load, removePerson } from "@/lib/service";

export const maxDuration = 60;

/** Riya adds or removes people from the trip. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/people">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const body = await req.json();
    const b = await load(slug);
    requireAdmin(b.trip.admin_key, body.adminKey);
    const now = await nowFor(b.trip);
    if (body.action === "add") return addPerson(slug, String(body.name ?? ""), String(body.phone ?? ""));
    if (body.action === "remove") return removePerson(slug, String(body.memberId), now);
    throw new AppError(400, "Unknown action");
  });
}
