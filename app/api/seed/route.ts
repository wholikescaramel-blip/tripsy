import { NextResponse } from "next/server";
import { TIME_COOKIE } from "@/lib/clock";
import { seedDemo } from "@/lib/seed";

export const maxDuration = 60;

/** (Re)create the demo trip with Riya, Siddharth, Karan, Aisha and Preethi. */
export async function POST() {
  try {
    const out = await seedDemo();
    const res = NextResponse.json(out);
    res.cookies.set(TIME_COOKIE, "0", { path: "/", maxAge: 60 * 60 * 24 * 30 });
    return res;
  } catch (err) {
    console.error(err);
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Couldn't create the demo trip: ${detail}` }, { status: 500 });
  }
}
