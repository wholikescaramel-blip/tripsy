import { handle } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { load, saveHardPasses } from "@/lib/service";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/passes">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, picked, notes } = await req.json();
    const b = await load(slug);
    return saveHardPasses(slug, String(memberId), Array.isArray(picked) ? picked.map(String) : [], String(notes ?? ""), await nowFor(b.trip));
  });
}
