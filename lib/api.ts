import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./errors";

/** Wrap a route handler so AppErrors become clean JSON responses. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json((await fn()) ?? { ok: true });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    // Database errors are safe to show (no keys in them) and make setup problems obvious.
    const msg = err instanceof Error && err.message.startsWith("Supabase:") ? `${err.message}. Open /status to check the setup.` : "Something went wrong. Please try again.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export function requireAdmin(tripKey: string, given: unknown) {
  if (typeof given !== "string" || given !== tripKey) throw new AppError(403, "Only the coordinator can do that.");
}

export function randomId(len: number) {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
