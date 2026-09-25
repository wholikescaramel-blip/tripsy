import "server-only";
import { hasSupabase, isHosted } from "../config";
import { AppError, DB_NOT_CONNECTED } from "../errors";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export { hasSupabase };

/** On Vercel without Supabase keys, fail loudly instead of silently losing data. */
const notConnected = new Proxy({} as Store, {
  get: (_t, prop) => (prop === "kind" ? "memory" : () => Promise.reject(new AppError(503, DB_NOT_CONNECTED))),
});

/** Supabase when keys are configured; in local dev without keys, an in-memory store (resets on restart). */
export const store: Store = hasSupabase ? supabaseStore : isHosted ? notConnected : memoryStore;
