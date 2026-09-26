import { handle, requireAdmin } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { load, voteDate, voteDateOnBehalf } from "@/lib/service";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/dates">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, optionId, vote, knowBy, adminKey } = await req.json();
    const b = await load(slug);
    if (adminKey !== undefined) {
      requireAdmin(b.trip.admin_key, adminKey);
      return voteDateOnBehalf(slug, String(memberId), String(optionId), vote, await nowFor(b.trip));
    }
    return voteDate(slug, String(memberId), String(optionId), vote, knowBy ?? null, await nowFor(b.trip));
  });
}
