import { handle, requireAdmin } from "@/lib/api";
import { store } from "@/lib/store";
import { AppError, load } from "@/lib/service";

/** Riya tapped "Send nudge": remember it so it drops off the "due now" list. */
export async function POST(req: Request, ctx: RouteContext<"/api/t/[slug]/nudges">) {
  const { slug } = await ctx.params;
  return handle(async () => {
    const { adminKey, memberId, kind } = await req.json();
    const b = await load(slug);
    requireAdmin(b.trip.admin_key, adminKey);
    if (!b.members.some((m) => m.id === memberId)) throw new AppError(404, "Unknown member");
    await store.logNudge({ trip_id: b.trip.id, member_id: memberId, nudge_kind: String(kind).slice(0, 60) });
    return { ok: true };
  });
}
