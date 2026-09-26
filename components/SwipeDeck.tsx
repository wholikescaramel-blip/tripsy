"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DECLINE_REASONS } from "@/lib/options";
import type { PlanView } from "@/lib/view";
import { PlanCard } from "./PlanCard";
import { SwipeButtons, Swipeable, type SwipeDir } from "./Swipeable";
import { buttonClass } from "./ui";

type Decision = "accept" | "decline";

/** Swipe on the final plans. Declining asks (optionally) why, so the blend can fix it. */
export function SwipeDeck({ slug, meId, plans, members }: { slug: string; meId: string; plans: PlanView[]; members: { id: string; name: string }[] }) {
  const router = useRouter();
  const [mine, setMine] = useState<Record<string, Decision>>(() => Object.fromEntries(plans.filter((p) => p.votes[meId]).map((p) => [p.id, p.votes[meId]])));
  const [fling, setFling] = useState<SwipeDir | null>(null);
  const [askReason, setAskReason] = useState<PlanView | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queue = plans.filter((p) => !mine[p.id]);
  const top = queue[0];

  async function send(plan: PlanView, decision: Decision, why: string | null) {
    setMine((m) => ({ ...m, [plan.id]: decision }));
    const res = await fetch(`/api/t/${slug}/swipes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: meId, planId: plan.id, decision, reason: why }),
    });
    if (!res.ok) {
      setError((await res.json().catch(() => ({}))).error ?? "Couldn't save your swipe");
      setMine((m) => {
        const next = { ...m };
        delete next[plan.id];
        return next;
      });
    }
    router.refresh();
  }

  const onSwipe = (dir: SwipeDir) => {
    setFling(null);
    if (!top) return;
    if (dir === "right") void send(top, "accept", null);
    else {
      setMine((m) => ({ ...m, [top.id]: "decline" }));
      setAskReason(top);
    }
  };

  if (askReason) {
    const submit = (why: string | null) => {
      void send(askReason, "decline", why);
      setAskReason(null);
      setReason("");
    };
    return (
      <div className="rounded-3xl border border-line bg-white p-5 shadow-card animate-pop">
        <p className="font-display text-xl font-bold">What&apos;s not working about {askReason.destination}?</p>
        <p className="mt-1 text-sm text-ink-soft">Optional. It helps the next plan fix it.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DECLINE_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${reason === r ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              {r}
            </button>
          ))}
        </div>
        <input
          value={DECLINE_REASONS.includes(reason) ? "" : reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Or say it in your words…"
          className="mt-3 w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-coral"
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button className={buttonClass("ghost")} onClick={() => submit(null)}>
            Skip
          </button>
          <button className={buttonClass("dark")} onClick={() => submit(reason || null)}>
            Send
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      {top ? (
        <>
          <p className="text-center text-sm font-semibold text-ink-soft">
            {plans.length - queue.length + 1} of {plans.length} · right if you&apos;d go, left if not
          </p>
          <div className="relative">
            {queue[1] && (
              <div className="pointer-events-none absolute inset-x-3 top-3 opacity-50 blur-[1px]" aria-hidden>
                <PlanCard plan={queue[1]} members={members} compact />
              </div>
            )}
            <Swipeable key={top.id} onSwipe={onSwipe} fling={fling} yesLabel="I'D GO" noLabel="NOPE">
              <PlanCard plan={top} members={members} meId={meId} />
            </Swipeable>
          </div>
          <div className="sticky bottom-4 z-10">
            <SwipeButtons onNo={() => setFling("left")} onYes={() => setFling("right")} disabled={fling !== null} />
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-line bg-white p-6 text-center shadow-card animate-pop">
          <p className="text-5xl">🗳️</p>
          <p className="mt-2 font-display text-xl font-bold">All swiped!</p>
          <p className="mt-1 text-sm text-ink-soft">We decide as soon as everyone&apos;s voted. Changed your mind? Tap to flip.</p>
          <ul className="mt-4 flex flex-col gap-2 text-left">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3">
                <span className="font-semibold">{p.destination}</span>
                <button
                  onClick={() => void send(p, mine[p.id] === "accept" ? "decline" : "accept", null)}
                  className={`rounded-full px-3 py-1 text-sm font-bold text-white ${mine[p.id] === "accept" ? "bg-free" : "bg-busy"}`}
                >
                  {mine[p.id] === "accept" ? "👍 I'd go" : "👎 Nope"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
