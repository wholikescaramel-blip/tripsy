import { handle } from "@/lib/api";
import { joinTrip } from "@/lib/service";

/** A friend opens the link, isn't on the list yet, and adds themselves. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/join">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { name, phone } = await req.json();
    return joinTrip(slug, String(name ?? ""), String(phone ?? ""));
  });
}
