import { handle } from "@/lib/api";
import { moreIdeas, swipeIdea } from "@/lib/service";

export const maxDuration = 60;

export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/ideas">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { memberId, ideaId, liked, more } = await req.json();
    if (more) return moreIdeas(slug, String(memberId));
    return swipeIdea(slug, String(memberId), String(ideaId), Boolean(liked));
  });
}
