import "server-only";
import { memoryStore } from "./memory";
import { supabaseStore } from "./supabase";
import type { Store } from "./types";

export const hasSupabase = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** Supabase when keys are configured, otherwise an in-memory store (data resets on restart). */
export const store: Store = hasSupabase ? supabaseStore : memoryStore;
