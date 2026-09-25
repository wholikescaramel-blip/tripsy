"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { waShare } from "@/lib/nudges";
import { fmtDateTime, fmtMonth, fromIstLocal, istDay, toIstLocal } from "@/lib/time";
import { Avatar, Card, buttonClass } from "./ui";

const inputClass = "w-full rounded-2xl border border-line bg-white px-4 py-3 text-base outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/15";

export function CreateTripForm() {
  const defaults = useMemo(() => {
    const now = new Date();
    const today = istDay(now);
    const [y, m] = today.split("-").map(Number);
    const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
    return { month: next, deadline: toIstLocal(new Date(now.getTime() + 4 * 86_400_000)).slice(0, 11) + "21:00" };
  }, []);
  const [name, setName] = useState("");
  const [month, setMonth] = useState(defaults.month);
  const [deadline, setDeadline] = useState(defaults.deadline);
  const [people, setPeople] = useState([
    { name: "", phone: "" },
    { name: "", phone: "" },
    { name: "", phone: "" },
  ]);
  const update = (i: number, key: "name" | "phone", value: string) => setPeople((ps) => ps.map((p, j) => (j === i ? { ...p, [key]: value } : p)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ slug: string; adminKey: string; memberId: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/trips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, month, deadline, people: people.filter((p) => p.name.trim()) }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) return setError(json.error);
    try {
      localStorage.setItem(`tripsy:${json.slug}`, json.memberId);
    } catch {}
    setCreated(json);
  }

  if (created) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const shareUrl = `${origin}/t/${created.slug}`;
    const adminUrl = `${origin}/t/${created.slug}/admin?key=${created.adminKey}`;
    const msg = `✈️ ${name} is happening! Tap the link, tap your name, say yes/no to a few dates and swipe some ideas for ${fmtMonth(`${month}-01`)}. Takes 1 min — closes ${fmtDateTime(fromIstLocal(deadline).toISOString())}. ${shareUrl}`;
    const copy = async (label: string, text: string) => {
      await navigator.clipboard.writeText(text).catch(() => {});
      setCopied(label);
      setTimeout(() => setCopied(null), 1500);
    };
    return (
      <div className="flex flex-col gap-5 animate-rise">
        <div className="text-center">
          <p className="text-6xl animate-float">🎒</p>
          <h1 className="mt-3 font-display text-3xl font-extrabold">Your trip is live!</h1>
          <p className="mt-1 text-ink-soft">Drop this one link in the group chat. Everyone taps their name — that&apos;s your last chasing job.</p>
        </div>
        <Card>
          <p className="text-xs font-bold tracking-wide text-ink-faint uppercase">Group link</p>
          <p className="mt-1 break-all font-mono text-sm">{shareUrl}</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <a href={waShare(msg)} target="_blank" rel="noreferrer" className={`${buttonClass("free")} text-sm`}>
              💬 WhatsApp
            </a>
            <button onClick={() => copy("link", shareUrl)} className={`${buttonClass("ghost")} text-sm`}>
              {copied === "link" ? "Copied ✓" : "📋 Copy link"}
            </button>
          </div>
        </Card>
        <Card tone="ink">
          <p className="text-xs font-bold tracking-wide text-white/60 uppercase">Your dashboard (keep this private)</p>
          <p className="mt-1 text-sm text-white/80">Bookmark it — nudges, who&apos;s in, dates and swipes all live here.</p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href={`/t/${created.slug}/admin?key=${created.adminKey}`} className={`${buttonClass("primary")} text-sm`}>
              Open dashboard
            </Link>
            <button onClick={() => copy("admin", adminUrl)} className="rounded-2xl border border-white/20 px-4 py-3 text-sm font-semibold">
              {copied === "admin" ? "Copied ✓" : "Copy link"}
            </button>
          </div>
        </Card>
        <Link href={`/t/${created.slug}/${created.memberId}/start`} className={`${buttonClass("ghost")} w-full`}>
          ✏️ Fill in your own answers
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <Card>
        <label className="block">
          <span className="text-sm font-semibold">Trip name</span>
          <input className={`${inputClass} mt-1.5`} placeholder="e.g. The Long-Overdue Reunion" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="text-sm font-semibold">Month</span>
            <input type="month" className={`${inputClass} mt-1.5`} value={month} onChange={(e) => setMonth(e.target.value)} required />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Answers due</span>
            <input type="datetime-local" className={`${inputClass} mt-1.5 text-sm`} value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
          </label>
        </div>
        <p className="mt-2 text-xs text-ink-faint">Times are IST. Nudges go out 48h, 24h and 12h before the deadline.</p>
      </Card>

      <Card>
        <p className="font-display text-lg font-bold">Who&apos;s going?</p>
        <p className="text-sm text-ink-soft">Just names. Numbers are optional — only for one-tap WhatsApp nudges. You can add or remove people later.</p>
        <div className="mt-4 flex flex-col gap-3">
          {people.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Avatar name={p.name || "?"} index={i} size={40} />
              <input
                className={`${inputClass} min-w-0 flex-[1.2]`}
                placeholder={i === 0 ? "Your name" : `Friend ${i}`}
                value={p.name}
                onChange={(e) => update(i, "name", e.target.value)}
                required={i < 2}
                maxLength={30}
              />
              <input className={`${inputClass} min-w-0 flex-1 text-sm`} placeholder="Phone (optional)" inputMode="tel" value={p.phone} onChange={(e) => update(i, "phone", e.target.value)} maxLength={20} />
              {i > 0 ? (
                <button type="button" aria-label="Remove" onClick={() => setPeople((ps) => ps.filter((_, j) => j !== i))} className="h-10 w-8 shrink-0 text-lg text-ink-faint">
                  ✕
                </button>
              ) : (
                <span className="w-8 shrink-0" />
              )}
            </div>
          ))}
        </div>
        {people.length < 20 && (
          <button type="button" className="mt-3 text-sm font-semibold text-coral-dark" onClick={() => setPeople((ps) => [...ps, { name: "", phone: "" }])}>
            + Add someone
          </button>
        )}
        <p className="mt-2 text-xs text-ink-faint">The first name is you — the coordinator.</p>
      </Card>

      {error && <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      <button disabled={busy} className={`${buttonClass("primary")} text-lg`}>
        {busy ? "Creating…" : "Create trip & get the link"}
      </button>
    </form>
  );
}
