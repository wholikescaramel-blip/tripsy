import { handle } from "@/lib/api";
import { swipeIdea } from "@/lib/service";

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/ideas">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, ideaId, liked } = await req.json();
    return swipeIdea(slug, String(memberId), String(ideaId), Boolean(liked));
  });
}
