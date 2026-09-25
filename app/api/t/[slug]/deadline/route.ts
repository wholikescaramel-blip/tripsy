import { handle, requireAdmin } from "@/lib/api";
import { nowFor } from "@/lib/clock";
import { load, setDeadline } from "@/lib/service";
import { fromIstLocal } from "@/lib/time";

/** Riya moves the answer deadline (IST, "YYYY-MM-DDTHH:mm"). */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/deadline">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { adminKey, deadline } = await req.json();
    const b = await load(slug);
    requireAdmin(b.trip.admin_key, adminKey);
    return setDeadline(slug, fromIstLocal(String(deadline ?? "")), await nowFor(b.trip));
  });
}
