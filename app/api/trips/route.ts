import { handle, randomId } from "@/lib/api";
import { store } from "@/lib/store";
import { AppError } from "@/lib/service";
import { fromIstLocal } from "@/lib/time";

export async function POST(req: Request) {
  return handle(async () => {
    const body = await req.json();
    const name = String(body.name ?? "").trim().slice(0, 60);
    const month = String(body.month ?? "");
    const members = (Array.isArray(body.members) ? body.members : [])
      .map((m: { name?: string; phone?: string }) => ({ name: String(m.name ?? "").trim().slice(0, 30), phone: String(m.phone ?? "").trim().slice(0, 20) }))
      .filter((m: { name: string }) => m.name);
    if (!name) throw new AppError(400, "Give the trip a name.");
    if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError(400, "Pick a target month.");
    if (members.length < 2) throw new AppError(400, "Add at least 2 friends.");
    if (new Set(members.map((m: { name: string }) => m.name.toLowerCase())).size !== members.length) throw new AppError(400, "Each friend needs a different name.");
    const deadline = fromIstLocal(String(body.deadline ?? ""));
    if (Number.isNaN(deadline.getTime())) throw new AppError(400, "Pick a submission deadline.");
    if (deadline.getTime() < Date.now()) throw new AppError(400, "The deadline should be in the future.");

    const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24) || "trip";
    const slug = `${base}-${randomId(5)}`;
    const adminKey = randomId(16);
    await store.createTrip({
      slug,
      admin_key: adminKey,
      name,
      target_month: `${month}-01`,
      deadline: deadline.toISOString(),
      is_demo: false,
      members: members.map((m: { name: string; phone: string }, i: number) => ({ ...m, is_coordinator: i === 0 })),
    });
    return { slug, adminKey };
  });
}
