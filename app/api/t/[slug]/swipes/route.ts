import { handle } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { AppError, load, pickFavourite, swipe } from "@/lib/service";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/swipes">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, planId, decision, reason } = await req.json();
    const b = await load(slug);
    if (decision === "pick") return pickFavourite(slug, memberId, planId, await nowFor(b.trip));
    if (decision !== "accept" && decision !== "decline") throw new AppError(400, "Bad decision");
    return swipe(slug, memberId, planId, decision, reason ?? null, await nowFor(b.trip));
  });
}
