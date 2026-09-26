"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

export function NudgeButton({ slug, adminKey, memberId, kind, href }: { slug: string; adminKey: string; memberId: string; kind: string; href: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        setSent(true);
        void fetch(`/api/t/${slug}/nudges`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ adminKey, memberId, kind }),
        }).then(() => setTimeout(() => router.refresh(), 800));
      }}
      className={`${buttonClass(sent ? "ghost" : "free")} shrink-0 px-4 py-2.5 text-sm`}
    >
      {sent ? "Sent ✓" : "💬 Send nudge"}
    </a>
  );
}

export function FreshPlansButton({ slug, adminKey, label = "🔄 Get fresh plans" }: { slug: string; adminKey: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm("Replace the current plans with 3 new ones? Swipes on the current ones are dropped.")) return;
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/t/${slug}/plans`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "fresh", adminKey }) });
          if (!res.ok) setError((await res.json()).error);
          setBusy(false);
          router.refresh();
        }}
        className={`${buttonClass("ghost")} w-full text-sm`}
      >
        {busy ? "Cooking…" : label}
      </button>
      {error && <p className="mt-2 text-center text-sm text-busy">{error}</p>}
    </div>
  );
}

export function CopyLink({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function StartPlanningButton({ slug, adminKey }: { slug: string; adminKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm("Everyone's here? Plans will be made from the people who've joined so far. Anyone who joins later is assumed free until they answer.")) return;
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/t/${slug}/plans`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "start", adminKey }) });
          if (!res.ok) setError((await res.json()).error);
          setBusy(false);
          router.refresh();
        }}
        className={`${buttonClass("primary")} w-full text-sm`}
      >
        {busy ? "Cooking up plans…" : "🚀 Everyone's here — start planning"}
      </button>
      {error && <p className="mt-2 text-center text-sm font-semibold text-busy">{error}</p>}
    </div>
  );
}

async function adminPost(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong");
  return json;
}

/** Riya adds someone to the trip. */
export function AddPerson({ slug, adminKey }: { slug: string; adminKey: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="mt-3 flex flex-col gap-2"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await adminPost(`/api/t/${slug}/people`, { adminKey, action: "add", name, phone });
          setName("");
          setPhone("");
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : String(err));
        }
        setBusy(false);
      }}
    >
      <div className="flex gap-2">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name" maxLength={30} className="min-w-0 flex-[1.2] rounded-2xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-coral" />
        <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" inputMode="tel" maxLength={20} className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-3 py-2.5 text-sm outline-none focus:border-coral" />
        <button disabled={busy || !name.trim()} className="shrink-0 rounded-2xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">
          +
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-busy">{error}</p>}
    </form>
  );
}

export function RemovePerson({ slug, adminKey, memberId, name }: { slug: string; adminKey: string; memberId: string; name: string }) {
  const router = useRouter();
  return (
    <button
      aria-label={`Remove ${name}`}
      onClick={async () => {
        if (!confirm(`Remove ${name} from the trip? Their answers are deleted.`)) return;
        try {
          await adminPost(`/api/t/${slug}/people`, { adminKey, action: "remove", memberId });
        } catch (err) {
          alert(err instanceof Error ? err.message : String(err));
        }
        router.refresh();
      }}
      className="h-8 w-8 shrink-0 rounded-full text-ink-faint hover:bg-busy-soft hover:text-busy"
    >
      ✕
    </button>
  );
}

/** Riya adds or removes a date option. */
export function DateOptionControls({ slug, adminKey, options }: { slug: string; adminKey: string; options: { id: string; label: string }[] }) {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const act = async (body: object) => {
    setBusy(true);
    setError(null);
    try {
      await adminPost(`/api/t/${slug}/options`, { adminKey, ...body });
      setStart("");
      setEnd("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setBusy(false);
  };
  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-sm font-semibold text-coral-dark">Add or remove date options</summary>
      <div className="mt-3 flex flex-col gap-3">
        <div className="flex items-end gap-2">
          <label className="flex-1 text-xs font-semibold">
            From
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm" />
          </label>
          <label className="flex-1 text-xs font-semibold">
            To
            <input type="date" value={end} min={start} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full rounded-2xl border border-line bg-white px-3 py-2 text-sm" />
          </label>
          <button disabled={busy || !start || !end} onClick={() => act({ action: "add", start, end })} className="rounded-2xl bg-ink px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          {options.map((o) => (
            <button
              key={o.id}
              disabled={busy}
              onClick={() => confirm(`Remove ${o.label}? Votes on it are deleted.`) && act({ action: "remove", optionId: o.id })}
              className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold"
            >
              {o.label} ✕
            </button>
          ))}
        </div>
        {error && <p className="text-sm font-semibold text-busy">{error}</p>}
      </div>
    </details>
  );
}

/** Riya moves the answer deadline. Reminders restart from the new one. */
export function DeadlineControl({ slug, adminKey, current }: { slug: string; adminKey: string; current: string }) {
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="mt-3 rounded-2xl bg-white/10 p-3">
      <p className="text-xs font-bold tracking-wide text-white/60 uppercase">Answer deadline (IST)</p>
      <div className="mt-2 flex gap-2">
        <input type="datetime-local" value={value} onChange={(e) => setValue(e.target.value)} className="min-w-0 flex-1 rounded-xl bg-white px-3 py-2 text-sm text-ink" />
        <button
          disabled={busy || value === current}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              await adminPost(`/api/t/${slug}/deadline`, { adminKey, deadline: value });
              setMsg("Deadline updated ✓");
              router.refresh();
            } catch (err) {
              setMsg(err instanceof Error ? err.message : String(err));
            }
            setBusy(false);
          }}
          className="shrink-0 rounded-xl bg-coral px-4 text-sm font-bold text-white disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {msg && <p className="mt-2 text-xs font-semibold">{msg}</p>}
    </div>
  );
}

type Vote = "yes" | "maybe" | "no" | "pending" | "assumed";
const NEXT: Record<Vote, "yes" | "maybe" | "no"> = { pending: "yes", assumed: "yes", yes: "maybe", maybe: "no", no: "yes" };
const ICON: Record<Vote, string> = { yes: "✅", maybe: "🤔", no: "❌", pending: "…", assumed: "✅" };

/** Tap a cell to change someone's date answer (✅ → 🤔 → ❌). Logged as "on their behalf". */
export function AdminVoteGrid({
  slug,
  adminKey,
  members,
  options,
}: {
  slug: string;
  adminKey: string;
  members: { id: string; name: string }[];
  options: { id: string; label: string; works: string; votes: Record<string, Vote> }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <div className="no-scrollbar overflow-x-auto">
        <table className="w-full text-center text-sm">
          <thead>
            <tr>
              <th className="py-1 pr-2 text-left text-xs font-bold text-ink-soft">Dates</th>
              {members.map((m) => (
                <th key={m.id} className="px-1 py-1 text-xs font-bold text-ink-soft">
                  {m.name.slice(0, 6)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {options.map((o) => (
              <tr key={o.id} className={o.works === "everyone" ? "bg-free-soft" : o.works === "maybe" ? "bg-maybe-soft" : ""}>
                <td className="py-1.5 pr-2 text-left text-xs font-bold whitespace-nowrap">{o.label}</td>
                {members.map((m) => {
                  const v = o.votes[m.id] ?? "pending";
                  const id = `${o.id}|${m.id}`;
                  return (
                    <td key={m.id} className="px-1 py-1">
                      <button
                        disabled={busy !== null}
                        onClick={async () => {
                          setBusy(id);
                          setError(null);
                          try {
                            await adminPost(`/api/t/${slug}/dates`, { adminKey, memberId: m.id, optionId: o.id, vote: NEXT[v] });
                            router.refresh();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : String(err));
                          }
                          setBusy(null);
                        }}
                        className="h-9 w-9 rounded-xl border border-line bg-white text-base transition active:scale-90 disabled:opacity-50"
                        aria-label={`${m.name}, ${o.label}: ${v}. Tap to change`}
                      >
                        {busy === id ? "…" : ICON[v]}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-faint">Tap to change someone&apos;s answer (✅ → 🤔 → ❌). The group sees it as changed by you, on their behalf.</p>
      {error && <p className="mt-1 text-sm font-semibold text-busy">{error}</p>}
    </div>
  );
}
