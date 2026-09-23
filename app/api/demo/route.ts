import { NextResponse } from "next/server";
import { TIME_COOKIE, nowFor } from "@/lib/clock";
import { demoAction, DEMO_SLUG } from "@/lib/seed";
import { AppError, load } from "@/lib/service";
import { istDay } from "@/lib/time";

export const maxDuration = 60;

const HOUR = 3_600_000;

/** Demo-only: time travel + "play the other friends" shortcuts. */
export async function POST(req: Request) {
  try {
    const { action } = await req.json();
    const b = await load(DEMO_SLUG);
    if (String(action).startsWith("time:")) {
      const deadline = Date.parse(b.trip.deadline);
      const preset = String(action).slice(5);
      let target = Date.now();
      if (preset === "48h") target = deadline - 47 * HOUR;
      else if (preset === "24h") target = deadline - 23 * HOUR;
      else if (preset === "12h") target = deadline - 11 * HOUR;
      else if (preset === "passed") target = deadline + HOUR;
      else if (preset === "maybe") {
        const kb = b.availability.map((a) => a.maybe_known_by).filter(Boolean).sort()[0];
        if (!kb) throw new AppError(409, "No open maybes right now.");
        target = Math.max(Date.parse(`${kb}T10:00:00+05:30`), Date.now());
      }
      const hours = Math.round(((target - Date.now()) / HOUR) * 100) / 100;
      const res = NextResponse.json({ message: `Clock set to ${istDay(new Date(target))} (${hours >= 0 ? "+" : ""}${Math.round(hours)}h)` });
      res.cookies.set(TIME_COOKIE, String(hours), { path: "/", maxAge: 60 * 60 * 24 * 30 });
      return res;
    }
    const message = await demoAction(String(action), await nowFor(b.trip));
    return NextResponse.json({ message });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Demo action failed." }, { status: 500 });
  }
}
