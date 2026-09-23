import "server-only";
import { cookies } from "next/headers";
import type { Trip } from "./types";

export const TIME_COOKIE = "tripsy_time_offset_h";

/** Current time. Demo trips can be "time-travelled" with a cookie so every stage is testable. */
export async function nowFor(trip: Pick<Trip, "is_demo">): Promise<Date> {
  if (!trip.is_demo) return new Date();
  const jar = await cookies();
  const hours = Number(jar.get(TIME_COOKIE)?.value ?? 0);
  return new Date(Date.now() + (Number.isFinite(hours) ? hours : 0) * 3_600_000);
}

export async function timeOffsetHours(): Promise<number> {
  const jar = await cookies();
  return Number(jar.get(TIME_COOKIE)?.value ?? 0) || 0;
}
