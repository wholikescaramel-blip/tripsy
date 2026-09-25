import { handle } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { load, saveBudget } from "@/lib/service";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/budget">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, tier, homeCity } = await req.json();
    const b = await load(slug);
    return saveBudget(slug, String(memberId), String(tier), String(homeCity ?? ""), await nowFor(b.trip));
  });
}
