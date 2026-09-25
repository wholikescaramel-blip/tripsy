import "server-only";
import { hasSupabase, isHosted, supabaseKeyIsSecret, supabaseUrlInvalid } from "../config";
import { AppError, DB_NOT_CONNECTED, DB_SECRET_KEY, DB_URL_INVALID } from "../errors";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export { hasSupabase };

/** Without a usable database on Vercel, fail loudly (with the fix) instead of silently losing data. */
const notConnected = new Proxy({} as Store, {
  get: (_t, prop) => (prop === "kind" ? "memory" : () => Promise.reject(new AppError(503, supabaseKeyIsSecret ? DB_SECRET_KEY : supabaseUrlInvalid ? DB_URL_INVALID : DB_NOT_CONNECTED))),
});

/** Supabase when keys are configured; in local dev without keys, an in-memory store (resets on restart). */
export const store: Store = hasSupabase ? supabaseStore : isHosted || supabaseUrlInvalid || supabaseKeyIsSecret ? notConnected : memoryStore;
