"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { DECLINE_REASONS } from "@/lib/options";
import type { PlanView } from "@/lib/view";
import { PlanCard } from "./PlanCard";
import { buttonClass } from "./ui";

type Decision = "accept" | "decline";

export function SwipeDeck({
  slug,
  meId,
  plans,
  members,
}: {
  slug: string;
  meId: string;
  plans: PlanView[];
  members: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [mine, setMine] = useState<Record<string, Decision>>(() => Object.fromEntries(plans.filter((p) => p.votes[meId]).map((p) => [p.id, p.votes[meId]])));
  const queue = plans.filter((p) => !mine[p.id]);
  const top = queue[0];
  const [dx, setDx] = useState(0);
  const [exiting, setExiting] = useState<Decision | null>(null);
  const [askReason, setAskReason] = useState<PlanView | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);

  async function send(plan: PlanView, decision: Decision, why: string | null) {
    setMine((m) => ({ ...m, [plan.id]: decision }));
    const res = await fetch(`/api/t/${slug}/swipes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: meId, planId: plan.id, decision, reason: why }),
    });
    if (!res.ok) {
      setError((await res.json()).error ?? "Couldn't save your swipe");
      setMine((m) => {
        const next = { ...m };
        delete next[plan.id];
        return next;
      });
    }
    router.refresh();
  }

  function decide(decision: Decision) {
    if (!top || exiting) return;
    setExiting(decision);
    setDx(decision === "accept" ? 600 : -600);
    setTimeout(() => {
      setExiting(null);
      setDx(0);
      if (decision === "decline") {
        setAskReason(top);
        setMine((m) => ({ ...m, [top.id]: "decline" }));
      } else void send(top, "accept", null);
    }, 260);
  }

  if (askReason) {
    return (
      <div className="rounded-3xl border border-line bg-white p-5 shadow-card animate-pop">
        <p className="font-display text-xl font-bold">What&apos;s not working about {askReason.destination}?</p>
        <p className="mt-1 text-sm text-ink-soft">Optional — it helps the blend fix it. (Budgets stay private either way.)</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DECLINE_REASONS.map((r) => (
            <button key={r} onClick={() => setReason(r)} className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${reason === r ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
              {r}
            </button>
          ))}
        </div>
        <input value={DECLINE_REASONS.includes(reason) ? "" : reason} onChange={(e) => setReason(e.target.value)} placeholder="Or say it in your words…" className="mt-3 w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-coral" />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            className={buttonClass("ghost")}
            onClick={() => {
              void send(askReason, "decline", null);
              setAskReason(null);
              setReason("");
            }}
          >
            Skip
          </button>
          <button
            className={buttonClass("dark")}
            onClick={() => {
              void send(askReason, "decline", reason || null);
              setAskReason(null);
              setReason("");
            }}
          >
            Send
          </button>
        </div>
      </div>
    );
  }

  const rotate = dx / 18;
  const yes = Math.max(0, Math.min(1, dx / 110));
  const no = Math.max(0, Math.min(1, -dx / 110));

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}
      {top ? (
        <>
          <p className="text-center text-sm font-semibold text-ink-soft">
            {plans.length - queue.length + 1} of {plans.length} · swipe right if you&apos;d go, left if not
          </p>
          <div className="relative">
            {queue[1] && (
              <div className="pointer-events-none absolute inset-x-3 top-3 opacity-60 blur-[1px]" aria-hidden>
                <PlanCard plan={queue[1]} members={members} compact />
              </div>
            )}
            <div
              className="relative touch-pan-y select-none"
              style={{
                transform: `translateX(${dx}px) rotate(${rotate}deg)`,
                transition: dragging && !exiting ? "none" : "transform 0.26s ease-out",
              }}
              onPointerDown={(e) => {
                start.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
              }}
              onPointerMove={(e) => {
                if (!start.current || start.current.id !== e.pointerId) return;
                const mx = e.clientX - start.current.x;
                if (Math.abs(mx) > 8) {
                  (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                  setDragging(true);
                  setDx(mx);
                }
              }}
              onPointerUp={() => {
                start.current = null;
                setDragging(false);
                if (dx > 110) decide("accept");
                else if (dx < -110) decide("decline");
                else setDx(0);
              }}
              onPointerCancel={() => {
                start.current = null;
                setDragging(false);
                setDx(0);
              }}
            >
              <div className="pointer-events-none absolute top-24 left-5 z-10 -rotate-12 rounded-2xl border-4 border-free bg-white/90 px-4 py-1 font-display text-3xl font-extrabold text-free" style={{ opacity: yes }}>
                I&apos;D GO
              </div>
              <div className="pointer-events-none absolute top-24 right-5 z-10 rotate-12 rounded-2xl border-4 border-busy bg-white/90 px-4 py-1 font-display text-3xl font-extrabold text-busy" style={{ opacity: no }}>
                NOPE
              </div>
              <PlanCard plan={top} members={members} meId={meId} />
            </div>
          </div>
          <div className="sticky bottom-4 z-10 flex items-center justify-center gap-6">
            <button onClick={() => decide("decline")} aria-label="Decline" className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white text-2xl shadow-card transition active:scale-90">
              ✕
            </button>
            <button onClick={() => decide("accept")} aria-label="Accept" className="flex h-20 w-20 items-center justify-center rounded-full bg-sunset text-3xl text-white shadow-lift transition active:scale-90">
              ♥
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-3xl border border-line bg-white p-6 text-center shadow-card animate-pop">
          <p className="text-5xl">🗳️</p>
          <p className="mt-2 font-display text-xl font-bold">All swiped!</p>
          <p className="mt-1 text-sm text-ink-soft">We&apos;ll decide as soon as everyone&apos;s voted. Changed your mind? Tap to flip.</p>
          <ul className="mt-4 flex flex-col gap-2 text-left">
            {plans.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-2xl bg-sand px-4 py-3">
                <span className="font-semibold">{p.destination}</span>
                <button
                  onClick={() => {
                    const flip = mine[p.id] === "accept" ? "decline" : "accept";
                    void send(p, flip, null);
                  }}
                  className={`rounded-full px-3 py-1 text-sm font-bold ${mine[p.id] === "accept" ? "bg-free text-white" : "bg-busy text-white"}`}
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
