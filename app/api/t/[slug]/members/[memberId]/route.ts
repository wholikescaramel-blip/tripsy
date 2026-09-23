import { handle } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { load, saveAnswers } from "@/lib/service";

export const maxDuration = 60;

export async function PUT(req: Request, ctx: RouteContext<"/api/t/[slug]/members/[memberId]">) {
  const { slug, memberId } = await ctx.params;
  return handle(async () => {
    const b = await load(slug);
    return saveAnswers(slug, memberId, await req.json(), await nowFor(b.trip));
  });
}
