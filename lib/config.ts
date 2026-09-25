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

/**
 * Forgive the usual copy-paste slips: quotes/spaces, a missing https://, a trailing /rest/v1,
 * the dashboard link (supabase.com/dashboard/project/<ref>) or just the project ref.
 */
export function normaliseSupabaseUrl(raw: string): string | null {
  let v = raw.trim().replace(/^["']|["']$/g, "").trim();
  const dash = v.match(/supabase\.com\/dashboard\/project\/([a-z0-9]{15,30})/i);
  if (dash) return `https://${dash[1].toLowerCase()}.supabase.co`;
  if (/^[a-z0-9]{15,30}$/i.test(v)) return `https://${v.toLowerCase()}.supabase.co`;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  v = v.replace(/\/(rest|auth)\/v1.*$/i, "").replace(/\/+$/, "");
  try {
    const u = new URL(v);
    return u.hostname.includes(".") || u.hostname === "localhost" ? `${u.protocol}//${u.host}` : null;
  } catch {
    return null;
  }
}

const rawUrl = pick("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_URL");
export const supabaseUrl = rawUrl ? { name: rawUrl.name, raw: rawUrl.value, value: normaliseSupabaseUrl(rawUrl.value) ?? "" } : null;
export const supabaseUrlInvalid = Boolean(supabaseUrl && !supabaseUrl.value);
export const supabaseKey = pick(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_ANON_KEY",
);
/** The secret / service_role key must never be used: it bypasses the budget privacy rules. */
function isSecretKey(key: string): boolean {
  if (key.startsWith("sb_secret_")) return true;
  const parts = key.split(".");
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(Buffer.from(parts[1], "base64url").toString()).role === "service_role";
  } catch {
    return false;
  }
}
export const supabaseKeyIsSecret = Boolean(supabaseKey && isSecretKey(supabaseKey.value));

export const hasSupabase = Boolean(supabaseUrl?.value && supabaseKey && !supabaseKeyIsSecret);

/** True on Vercel, where the in-memory fallback can't work (each request may hit a different server). */
export const isHosted = Boolean(process.env.VERCEL);
