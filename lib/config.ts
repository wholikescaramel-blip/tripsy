import "server-only";

// Accept the names Supabase's dashboard shows as well as the Next.js-style ones,
// so a Vercel setup with either naming works.
const pick = (...names: string[]) => {
  for (const n of names) {
    const v = process.env[n]?.trim();
    if (v) return { value: v, name: n };
  }
  return null;
};

export const supabaseUrl = pick("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
export const supabaseKey = pick(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
);
export const hasSupabase = Boolean(supabaseUrl && supabaseKey);

/** True on Vercel, where the in-memory fallback can't work (each request may hit a different server). */
export const isHosted = Boolean(process.env.VERCEL);
