import { handle } from "@/lib/api";
import { setConfirmed } from "@/lib/service";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/confirm">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, confirmed } = await req.json();
    return setConfirmed(slug, memberId, Boolean(confirmed));
  });
}
