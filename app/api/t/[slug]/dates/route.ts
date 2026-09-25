import { handle } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { load, voteDate } from "@/lib/service";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/dates">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, optionId, vote, knowBy } = await req.json();
    const b = await load(slug);
    return voteDate(slug, String(memberId), String(optionId), vote, knowBy ?? null, await nowFor(b.trip));
  });
}
