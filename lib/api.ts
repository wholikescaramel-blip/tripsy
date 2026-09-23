import "server-only";
import { NextResponse } from "next/server";
import { AppError } from "./service";

/** Wrap a route handler so AppErrors become clean JSON responses. */
export async function handle(fn: () => Promise<unknown>) {
  try {
    return NextResponse.json((await fn()) ?? { ok: true });
  } catch (err) {
    if (err instanceof AppError) return NextResponse.json({ error: err.message }, { status: err.status });
    console.error(err);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
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
