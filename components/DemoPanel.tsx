"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TIME = [
  { action: "time:now", label: "Real now" },
  { action: "time:48h", label: "48h left" },
  { action: "time:24h", label: "24h left" },
  { action: "time:12h", label: "11h left" },
  { action: "time:maybe", label: "Maybe day" },
  { action: "time:passed", label: "Deadline passed" },
];

const PEOPLE = [
  { action: "fill-preethi", label: "📝 Preethi submits" },
  { action: "swipe-split", label: "🃏 Others swipe: split" },
  { action: "swipe-yes", label: "🃏 Others swipe: all yes" },
  { action: "pick-others", label: "🏆 Others pick a favourite" },
  { action: "sid-maybe-yes", label: "🤔→✅ Siddharth's maybe = yes" },
  { action: "sid-maybe-no", label: "🤔→❌ Siddharth's maybe = no" },
  { action: "karan-busy", label: "📆 Karan busy 9–10th" },
  { action: "aisha-veto-beach", label: "🙅 Aisha vetoes beaches" },
  { action: "confirm-others", label: "✅ Others confirm" },
];

/** Only on the demo trip: time travel + act as the other friends. */
export function DemoPanel({ offsetHours, links }: { offsetHours: number; links: { name: string; href: string }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(action: string) {
    setBusy(action);
    setMsg(null);
    const res = await fetch("/api/demo", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) });
    const json = await res.json();
    setMsg(json.message ?? json.error);
    setBusy(null);
    router.refresh();
  }

  async function reset() {
    if (!confirm("Start the demo over?")) return;
    setBusy("reset");
    await fetch("/api/seed", { method: "POST" });
    setBusy(null);
    setMsg("Fresh demo trip created.");
    router.refresh();
  }

  return (
    <details className="group rounded-3xl border-2 border-dashed border-plum/30 bg-plum/5 p-4" open>
      <summary className="flex cursor-pointer list-none items-center justify-between font-display font-bold text-plum">
        🧪 Demo controls
        <span className="text-xs font-semibold text-plum/70 group-open:hidden">tap to open</span>
      </summary>
      <p className="mt-2 text-xs text-ink-soft">
        Test every stage alone. Clock offset: <b>{offsetHours >= 0 ? "+" : ""}{Math.round(offsetHours)}h</b>
      </p>
      <p className="mt-3 mb-1.5 text-xs font-bold text-ink-soft uppercase">⏱️ Time travel</p>
      <div className="flex flex-wrap gap-1.5">
        {TIME.map((t) => (
          <button key={t.action} disabled={!!busy} onClick={() => run(t.action)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold border border-line disabled:opacity-50">
            {busy === t.action ? "…" : t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 mb-1.5 text-xs font-bold text-ink-soft uppercase">🎭 Play the others</p>
      <div className="flex flex-wrap gap-1.5">
        {PEOPLE.map((t) => (
          <button key={t.action} disabled={!!busy} onClick={() => run(t.action)} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold border border-line disabled:opacity-50">
            {busy === t.action ? "…" : t.label}
          </button>
        ))}
      </div>
      <p className="mt-3 mb-1.5 text-xs font-bold text-ink-soft uppercase">👀 Open as</p>
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => (
          <a key={l.name} href={l.href} className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-white">
            {l.name}
          </a>
        ))}
        <button onClick={reset} disabled={!!busy} className="rounded-full bg-busy-soft px-3 py-1.5 text-xs font-semibold text-rose-800">
          ↺ Reset demo
        </button>
      </div>
      {msg && <p className="mt-3 rounded-2xl bg-white px-3 py-2 text-sm font-semibold animate-pop">{msg}</p>}
    </details>
  );
}
