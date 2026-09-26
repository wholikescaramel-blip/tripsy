"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlanView } from "@/lib/view";
import { fmtRange, inr } from "@/lib/time";
import { planLook } from "./PlanCard";

/** 2+ plans got a yes from everyone: tap your favourite. Most taps wins, a tie goes to the cheaper one. */
export function FinalPick({
  slug,
  meId,
  plans,
  picks,
  waitingOn,
}: {
  slug: string;
  meId: string;
  plans: PlanView[];
  picks: Record<string, string>;
  waitingOn: string[];
}) {
  const router = useRouter();
  const [mine, setMine] = useState<string | null>(picks[meId] ?? null);
  const [error, setError] = useState<string | null>(null);

  async function pick(planId: string) {
    const before = mine;
    setMine(planId);
    setError(null);
    const res = await fetch(`/api/t/${slug}/swipes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: meId, planId, decision: "pick" }),
    });
    if (!res.ok) {
      setMine(before);
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save your pick");
    }
    router.refresh();
  }

  const count = (id: string) => Object.values(picks).filter((x) => x === id).length;

  return (
    <div className="flex flex-col gap-3 rounded-3xl border-2 border-coral/30 bg-white p-5 shadow-card animate-pop">
      <div>
        <p className="text-4xl">🏆</p>
        <p className="mt-1 font-display text-2xl font-extrabold">Everyone said yes to {plans.length}!</p>
        <p className="text-sm text-ink-soft">Tap your favourite. Most taps wins.</p>
      </div>
      {error && <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      {plans.map((p) => {
        const look = planLook(p);
        const on = mine === p.id;
        return (
          <button
            key={p.id}
            onClick={() => void pick(p.id)}
            className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition active:scale-[0.98] ${on ? "border-coral bg-coral/5" : "border-line bg-white"}`}
          >
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl" style={{ background: look.gradient }}>
              {look.emoji}
            </span>
            <span className="flex-1">
              <span className="block font-display text-lg font-bold">{p.destination}</span>
              <span className="block text-xs text-ink-soft">
                {fmtRange(p.start_date, p.end_date)} · ≈ {inr(p.cost_per_person)}
              </span>
            </span>
            <span className="text-right text-xs font-bold text-ink-soft">
              {on ? <span className="text-2xl">💖</span> : null}
              <span className="block">{count(p.id)} 💖</span>
            </span>
          </button>
        );
      })}
      <p className="text-xs text-ink-faint">
        {waitingOn.length ? `Waiting on ${waitingOn.join(", ")}.` : "Everyone's picked!"} You can change your pick until the last one is in.
      </p>
    </div>
  );
}
