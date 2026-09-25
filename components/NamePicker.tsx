"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "./ui";

const inputClass =
  "w-full rounded-2xl border border-line bg-white px-4 py-3.5 text-lg outline-none transition focus:border-coral focus:ring-4 focus:ring-coral/15";

/** Pick your name if you've been here before — or add yourself. */
export function NamePicker({ slug, members, locked }: { slug: string; members: { id: string; name: string; submitted: boolean }[]; locked: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"join" | "pick">("join");
  const [choice, setChoice] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remembered, setRemembered] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem(`tripsy:${slug}`);
      const m = members.find((x) => x.id === id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
      if (m) setRemembered({ id: m.id, name: m.name });
    } catch {}
  }, [slug, members]);

  const remember = (id: string) => {
    try {
      localStorage.setItem(`tripsy:${slug}`, id);
    } catch {}
  };

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/t/${slug}/join`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, phone }),
    });
    const json = await res.json();
    if (!res.ok) {
      setBusy(false);
      return setError(json.error);
    }
    remember(json.memberId);
    router.push(`/t/${slug}/${json.memberId}/form`);
  }

  return (
    <div className="flex flex-col gap-4">
      {remembered && (
        <button
          onClick={() => {
            remember(remembered.id);
            router.push(`/t/${slug}/${remembered.id}`);
          }}
          className={`${buttonClass("dark")} w-full`}
        >
          Continue as {remembered.name} →
        </button>
      )}

      {!locked && members.length > 0 && (
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-sand p-1 text-sm font-bold">
          <button type="button" onClick={() => setMode("join")} className={`rounded-xl py-2.5 transition ${mode === "join" ? "bg-white shadow-card" : "text-ink-soft"}`}>
            I&apos;m new here
          </button>
          <button type="button" onClick={() => setMode("pick")} className={`rounded-xl py-2.5 transition ${mode === "pick" ? "bg-white shadow-card" : "text-ink-soft"}`}>
            I&apos;ve joined before
          </button>
        </div>
      )}

      {mode === "join" && !locked ? (
        <form onSubmit={join} className="flex flex-col gap-3">
          <label className="block">
            <span className="text-sm font-semibold">What should we call you?</span>
            <input className={`${inputClass} mt-1.5`} placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoFocus required maxLength={30} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">
              WhatsApp number <span className="font-normal text-ink-faint">(optional — for reminders only)</span>
            </span>
            <input className={`${inputClass} mt-1.5`} placeholder="98xxxxxxxx" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
          </label>
          {error && <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
          <button disabled={busy || !name.trim()} className={`${buttonClass("primary")} w-full text-lg`}>
            {busy ? "Adding you…" : "Join the trip →"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-sm font-semibold">Who are you?</span>
            <select
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
              className="mt-1.5 w-full appearance-none rounded-2xl border border-line bg-white px-4 py-4 text-lg font-semibold outline-none focus:border-coral focus:ring-4 focus:ring-coral/15"
            >
              <option value="">Pick your name…</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.submitted ? " ✓" : ""}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!choice}
            onClick={() => {
              remember(choice);
              router.push(`/t/${slug}/${choice}`);
            }}
            className={`${buttonClass("primary")} w-full text-lg`}
          >
            That&apos;s me — let&apos;s go
          </button>
        </div>
      )}
    </div>
  );
}
