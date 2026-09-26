import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui";
import { hasSupabase, isHosted, supabaseKey, supabaseKeyIsSecret, supabaseUrl } from "@/lib/config";
import { pingGemini } from "@/lib/gemini";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup status | Tripsy" };

type Check = { label: string; ok: boolean | null; detail: string; fix?: string };

async function databaseChecks(): Promise<Check[]> {
  const urlOk = Boolean(supabaseUrl?.value);
  const checks: Check[] = [
    {
      label: "Supabase URL",
      ok: urlOk,
      detail: supabaseUrl ? (urlOk ? `Found in ${supabaseUrl.name} → ${new URL(supabaseUrl.value).host}${supabaseUrl.raw.trim() !== supabaseUrl.value ? " (tidied up automatically)" : ""}` : `${supabaseUrl.name} is set but isn't a web address (starts with “${supabaseUrl.raw.slice(0, 12)}…”)`) : "Not set",
      fix: "Add NEXT_PUBLIC_SUPABASE_URL = your Project URL (Supabase → Project Settings → Data API), e.g. https://abcd.supabase.co",
    },
    {
      label: "Supabase public key",
      ok: Boolean(supabaseKey) && !supabaseKeyIsSecret,
      detail: supabaseKey
        ? supabaseKeyIsSecret
          ? `${supabaseKey.name} holds a SECRET key. Use the publishable key instead`
          : `Found in ${supabaseKey.name} (${supabaseKey.value.slice(0, 15)}…)`
        : "Not set",
      fix: "Add NEXT_PUBLIC_SUPABASE_ANON_KEY = your publishable key (sb_publishable_…) from Supabase → Project Settings → API Keys",
    },
  ];
  if (!hasSupabase || !urlOk) return checks;
  const sb = createClient(supabaseUrl!.value, supabaseKey!.value, { auth: { persistSession: false } });
  try {
    // One query per table the app uses; the first error tells you what's missing.
    let error: { message: string } | null = null;
    for (const t of ["trips", "members", "date_options", "date_votes", "ideas", "idea_swipes", "preferences", "plans", "swipes", "changes", "nudge_log"]) {
      const res = await sb.from(t).select("*").limit(1);
      if (res.error) {
        error = { message: `${t}: ${res.error.message}` };
        break;
      }
    }
    const denied = error?.message.includes("permission denied");
    checks.push({
      label: "Database tables",
      ok: !error,
      detail: error ? error.message : "All 11 tables found and readable",
      fix: denied
        ? "Tables exist but the public key isn't allowed in. In Supabase → SQL Editor → New query, paste supabase/fix-permissions.sql and Run. It keeps your data."
        : "Run the latest supabase/schema.sql in Supabase → SQL Editor (click “Run without RLS”, the file turns RLS on itself).",
    });
    const { error: rpcError } = await sb.rpc("budget_ceiling", { p_trip: "00000000-0000-0000-0000-000000000000" });
    checks.push({
      label: "Private budget functions",
      ok: !rpcError,
      detail: rpcError ? rpcError.message : "Working",
      fix: "Run supabase/fix-permissions.sql in Supabase → SQL Editor (safe, keeps data).",
    });
    const { error: leak } = await sb.from("member_budgets").select("member_id").limit(1);
    checks.push({
      label: "Budgets hidden from the public key",
      ok: Boolean(leak),
      detail: leak ? "Yes, budgets can't be read" : "NO, budgets are readable! Run supabase/fix-permissions.sql",
    });
  } catch (err) {
    checks.push({ label: "Database connection", ok: false, detail: err instanceof Error ? err.message : String(err), fix: "Check the Project URL is right and the project isn't paused." });
  }
  return checks;
}

export default async function Status() {
  const [db, gemini] = await Promise.all([databaseChecks(), pingGemini()]);
  const checks: Check[] = [
    ...db,
    {
      label: "Gemini",
      ok: gemini.ok ? true : process.env.GEMINI_API_KEY ? false : null,
      detail: gemini.ok ? `Working (${gemini.model})` : gemini.error ?? "",
      fix: "Add GEMINI_API_KEY from aistudio.google.com/apikey. Without it the app uses sample plans.",
    },
  ];
  const allGood = checks.every((c) => c.ok !== false);

  return (
    <main className="flex flex-col gap-5 pt-6">
      <Link href="/" className="text-sm font-semibold text-ink-soft">
        ← Home
      </Link>
      <div>
        <h1 className="font-display text-3xl font-extrabold">Setup status {allGood ? "✅" : "🛠️"}</h1>
        <p className="mt-1 text-ink-soft">
          {allGood ? "Everything's connected." : "Something needs fixing, see the red rows. Changed Vercel env vars? Redeploy."}
        </p>
        {!hasSupabase && !isHosted && <p className="mt-2 text-sm text-ink-soft">Running locally without a database: data is kept in memory until restart.</p>}
      </div>
      <Card>
        <ul className="flex flex-col gap-4">
          {checks.map((c) => (
            <li key={c.label} className="flex gap-3">
              <span className="text-xl">{c.ok === true ? "✅" : c.ok === false ? "❌" : "⚪"}</span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{c.label}</p>
                <p className="text-sm break-words text-ink-soft">{c.detail}</p>
                {c.ok === false && c.fix && <p className="mt-1 rounded-xl bg-busy-soft px-3 py-2 text-xs font-semibold text-rose-900">Fix: {c.fix}</p>}
              </div>
            </li>
          ))}
        </ul>
      </Card>
      <p className="text-center text-xs text-ink-faint">This page never shows full keys.</p>
    </main>
  );
}
