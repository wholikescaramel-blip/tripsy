import { handle, randomId } from "@/lib/api";
import { AppError, createTrip } from "@/lib/service";
import { fromIstLocal } from "@/lib/time";

export const maxDuration = 60;

/** Riya creates the trip and lists who's going. Everyone gets the same link and taps their name. */
export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const name = String(body.name ?? "").trim().slice(0, 60);
    const month = String(body.month ?? "");
    const people = (Array.isArray(body.people) ? body.people : [])
      .map((p: { name?: string; phone?: string }) => ({ name: String(p.name ?? "").trim().replace(/\s+/g, " ").slice(0, 30), phone: String(p.phone ?? "").trim().slice(0, 20) }))
      .filter((p: { name: string }) => p.name);
    if (!name) throw new AppError(400, "Give the trip a name.");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError(400, "Pick a month.");
    if (people.length < 2) throw new AppError(400, "Add at least one friend besides you.");
    if (new Set(people.map((p: { name: string }) => p.name.toLowerCase())).size !== people.length) throw new AppError(400, "Two people have the same name — add a surname.");
    const deadline = fromIstLocal(String(body.deadline ?? ""));
    if (Number.isNaN(deadline.getTime())) throw new AppError(400, "Pick a deadline for answers.");
    if (deadline.getTime() < Date.now()) throw new AppError(400, "The deadline should be in the future.");

    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "trip";
    const slug = `${base}-${randomId(5)}`;
    const adminKey = randomId(16);
    const b = await createTrip({ slug, adminKey, name, month, deadline: deadline.toISOString(), people });
    return { slug, adminKey, memberId: b.members[0].id };
  });
}
