"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BUDGET_TIERS, CITIES, HARD_PASS_KEYS, KNOW_BY, MAX_IDEAS, VETO_BY_KEY, matchHardPasses } from "@/lib/options";
import { fmtDay, fmtRange, inr } from "@/lib/time";
import type { DateVoteValue, Idea } from "@/lib/types";
import { SwipeButtons, Swipeable, type SwipeDir } from "./Swipeable";
import { buttonClass } from "./ui";

export interface QuickStepsProps {
  slug: string;
  memberId: string;
  name: string;
  startStep: number;
  submitted: boolean;
  options: { id: string; start: string; end: string }[];
  votes: Record<string, { vote: DateVoteValue; knownBy: string | null }>;
  ideas: Idea[];
  ideaSwipes: Record<string, boolean>;
  hasBudget: boolean;
  homeCity: string;
  vetoes: string[];
  vetoNotes: string;
}

const STEPS = [
  { title: "Which dates work?", emoji: "📅", hint: "Tap one answer for each." },
  { title: "Would you go?", emoji: "🃏", hint: "Swipe right if it sounds fun, left if not." },
  { title: "Budget & home base", emoji: "💸", hint: "Only you see this." },
  { title: "Any hard passes?", emoji: "🙅", hint: "Plans will never include these. Skip if you're easy." },
];

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Couldn't save. Check your connection.");
  return json;
}

export function QuickSteps(p: QuickStepsProps) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(p.startStep, 0), 3));
  const [votes, setVotes] = useState(p.votes);
  const [swipes, setSwipes] = useState(p.ideaSwipes);
  const [tier, setTier] = useState<string | null>(null);
  const [city, setCity] = useState(p.homeCity);
  const [picked, setPicked] = useState<string[]>(p.vetoes.filter((v) => HARD_PASS_KEYS.includes(v)));
  const [notes, setNotes] = useState(p.vetoNotes);
  const [typing, setTyping] = useState(Boolean(p.vetoNotes));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  // router.refresh() after saving updates the props, so remember whether this was the first time.
  const [firstTime] = useState(!p.submitted);
  const base = `/api/t/${p.slug}`;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  };

  // --- step 1: dates
  const vote = (optionId: string, v: DateVoteValue, knowBy: string | null = null) => {
    setVotes((x) => ({ ...x, [optionId]: { vote: v, knownBy: knowBy } }));
    void run(() => post(`${base}/dates`, { memberId: p.memberId, optionId, vote: v, knowBy }));
  };
  const allVoted = p.options.every((o) => votes[o.id]);

  // --- step 2: ideas
  const queue = p.ideas.filter((i) => swipes[i.id] === undefined);
  const [fling, setFling] = useState<SwipeDir | null>(null);
  const likedAny = p.ideas.some((i) => swipes[i.id]);
  // Said no to everything? Top up with a few more cards (up to MAX_IDEAS) until something clicks.
  const [moreAt, setMoreAt] = useState<number | null>(null); // ideas.length when we asked for more
  const [noMore, setNoMore] = useState(p.ideas.length >= MAX_IDEAS);
  const loadingMore = moreAt === p.ideas.length && !noMore;
  const askMore = () => {
    setMoreAt(p.ideas.length);
    void run(async () => {
      const out = (await post(`${base}/ideas`, { memberId: p.memberId, more: true })) as { added?: number };
      if (!out?.added) setNoMore(true);
      router.refresh();
    }).then((ok) => !ok && setNoMore(true));
  };
  const swipeIdea = (idea: Idea, dir: SwipeDir) => {
    setFling(null);
    const next = { ...swipes, [idea.id]: dir === "right" };
    setSwipes(next);
    void run(() => post(`${base}/ideas`, { memberId: p.memberId, ideaId: idea.id, liked: dir === "right" }));
    const doneAll = p.ideas.every((i) => next[i.id] !== undefined);
    if (doneAll && !Object.values(next).some(Boolean) && !noMore && queue.length > 0) askMore();
  };

  // --- step 3: budget
  const needBudget = !p.hasBudget || tier !== null;
  const saveBudget = async () => {
    if (!tier && p.hasBudget) {
      // Budget already saved privately; just update the city if it changed.
      if (city !== p.homeCity) return run(() => post(`${base}/budget`, { memberId: p.memberId, tier: "keep", homeCity: city }));
      return true;
    }
    return run(() => post(`${base}/budget`, { memberId: p.memberId, tier, homeCity: city }));
  };

  // --- step 4: hard passes
  const typedMatches = matchHardPasses(notes).filter((k) => !picked.includes(k));
  const finish = async (none = false) => {
    setBusy(true);
    const ok = await run(() => post(`${base}/passes`, { memberId: p.memberId, picked: none ? [] : picked, notes: none ? "" : notes }));
    setBusy(false);
    if (ok) {
      setFinished(true);
      router.refresh();
    }
  };

  const next = async () => {
    if (step === 2) {
      setBusy(true);
      const ok = await saveBudget();
      setBusy(false);
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, 3));
  };

  if (finished) {
    return (
      <div className="flex flex-col items-center gap-4 pt-10 text-center animate-rise">
        <p className="text-7xl animate-float">🥳</p>
        <h2 className="font-display text-3xl font-extrabold">{!firstTime ? "Saved!" : `You're in, ${p.name}!`}</h2>
        <p className="max-w-xs text-ink-soft">
          {!firstTime ? "The group sees what changed, and any plan that no longer works gets fixed on its own." : "That's all. We'll let you know when there are plans to swipe."}
        </p>
        <Link href={`/t/${p.slug}/${p.memberId}`} className={`${buttonClass("primary")} w-full`}>
          See the trip →
        </Link>
      </div>
    );
  }

  const canNext = [allVoted, queue.length === 0 && (likedAny || noMore), !needBudget || Boolean(tier), true][step];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              aria-label={s.title}
              onClick={() => i < step && setStep(i)}
              className={`h-2 flex-1 rounded-full transition-all ${i < step ? "bg-ink" : i === step ? "bg-sunset" : "bg-line"}`}
            />
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-coral-dark">
          {p.name} · {step + 1} of 4
        </p>
        <h1 className="font-display text-3xl font-extrabold">
          {STEPS[step].title} <span className="inline-block animate-wiggle">{STEPS[step].emoji}</span>
        </h1>
        <p className="text-ink-soft">{STEPS[step].hint}</p>
      </div>

      <div key={step} className="animate-rise">
        {step === 0 && (
          <ul className="flex flex-col gap-3">
            {p.options.map((o) => {
              const v = votes[o.id];
              const btn = (val: DateVoteValue, label: string, on: string) => (
                <button
                  type="button"
                  onClick={() => vote(o.id, val, val === "maybe" ? (KNOW_BY.find((k) => k.key === "next_week")?.key ?? null) : null)}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-bold transition active:scale-95 ${v?.vote === val ? on : "bg-sand text-ink-soft"}`}
                >
                  {label}
                </button>
              );
              return (
                <li key={o.id} className="rounded-3xl border border-line bg-white p-4 shadow-card">
                  <p className="font-display text-lg font-bold">{fmtRange(o.start, o.end)}</p>
                  <p className="text-xs text-ink-faint">
                    {fmtDay(o.start, true)} → {fmtDay(o.end, true)}
                  </p>
                  <div className="mt-3 flex gap-2">
                    {btn("yes", "✅ I'm in", "bg-free text-white")}
                    {btn("maybe", "🤔 Maybe", "bg-maybe text-white")}
                    {btn("no", "❌ Can't", "bg-busy text-white")}
                  </div>
                  {v?.vote === "maybe" && (
                    <div className="mt-3 animate-pop">
                      <p className="text-xs font-bold text-amber-900">When will you know?</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {KNOW_BY.map((k) => (
                          <button
                            key={k.key}
                            type="button"
                            onClick={() => vote(o.id, "maybe", k.key)}
                            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                              (v.knownBy ?? "next_week") === k.key ? "bg-maybe text-white" : "border border-maybe/40 bg-maybe-soft text-amber-900"
                            }`}
                          >
                            {k.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-4">
            {queue.length ? (
              <>
                <p className="text-center text-sm font-semibold text-ink-soft">
                  {p.ideas.length - queue.length + 1} of {p.ideas.length}
                </p>
                <div className="relative">
                  {queue[1] && (
                    <div className="pointer-events-none absolute inset-x-3 top-3 opacity-50 blur-[1px]" aria-hidden>
                      <IdeaCard idea={queue[1]} />
                    </div>
                  )}
                  <Swipeable key={queue[0].id} onSwipe={(d) => swipeIdea(queue[0], d)} fling={fling} yesLabel="I'D GO" noLabel="NAH">
                    <IdeaCard idea={queue[0]} />
                  </Swipeable>
                </div>
                <SwipeButtons onNo={() => setFling("left")} onYes={() => setFling("right")} disabled={fling !== null} />
              </>
            ) : loadingMore ? (
              <div className="rounded-3xl border border-line bg-white p-6 text-center shadow-card animate-pop">
                <p className="text-5xl animate-float">🧭</p>
                <p className="mt-2 font-display text-xl font-bold">Nothing grabbed you? Fair.</p>
                <p className="mt-1 text-sm text-ink-soft">Finding a few different ones…</p>
              </div>
            ) : (
              <div className="rounded-3xl border border-line bg-white p-5 shadow-card">
                <p className="font-display text-lg font-bold">Your picks</p>
                <p className="text-sm text-ink-soft">{likedAny ? "Tap to change your mind." : noMore ? "Nothing clicked, and that's okay. Tap one if you change your mind." : "Like at least one so plans know what you're into."}</p>
                {!likedAny && !noMore && (
                  <button type="button" onClick={askMore} className={`${buttonClass("dark")} mt-3 w-full text-sm`}>
                    🧭 Show me different ones
                  </button>
                )}
                <ul className="mt-3 flex flex-col gap-2">
                  {p.ideas.map((i) => (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => swipeIdea(i, swipes[i.id] ? "left" : "right")}
                        className="flex w-full items-center justify-between rounded-2xl bg-sand px-4 py-3 text-left"
                      >
                        <span className="font-semibold">
                          {i.emoji} {i.destination}
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-bold text-white ${swipes[i.id] ? "bg-free" : "bg-busy"}`}>{swipes[i.id] ? "♥ I'd go" : "✕ Nah"}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              {p.hasBudget && tier === null && <p className="rounded-2xl bg-free-soft px-4 py-3 text-sm font-semibold text-emerald-900">✓ Your budget is saved privately. Tap one to change it.</p>}
              {BUDGET_TIERS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setTier(t.key)}
                  className={`flex items-center gap-4 rounded-3xl px-5 py-4 text-left transition active:scale-[0.98] ${tier === t.key ? "bg-sunset text-white shadow-lift" : "border border-line bg-white shadow-card"}`}
                >
                  <span className="text-3xl">{t.emoji}</span>
                  <span>
                    <span className="block font-display text-lg font-bold">{t.label}</span>
                    <span className={`text-sm ${tier === t.key ? "text-white/85" : "text-ink-soft"}`}>{t.range} per person, all in</span>
                  </span>
                </button>
              ))}
              <p className="text-center text-xs text-ink-faint">🔒 The group only ever sees whether a plan fits everyone.</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-ink-soft">🏠 Travelling from? (optional)</p>
              <div className="flex flex-wrap gap-2">
                {CITIES.map((c) => (
                  <button key={c} type="button" onClick={() => setCity(c)} className={`rounded-full border px-3.5 py-2 text-sm font-semibold ${city === c ? "border-ink bg-ink text-white" : "border-line bg-white"}`}>
                    {c}
                  </button>
                ))}
                <input
                  value={CITIES.includes(city) ? "" : city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Other…"
                  className="w-28 rounded-full border border-line bg-white px-3.5 py-2 text-sm outline-none focus:border-coral"
                />
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {HARD_PASS_KEYS.map((k) => {
                const o = VETO_BY_KEY[k];
                const on = picked.includes(k);
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setPicked((x) => (on ? x.filter((y) => y !== k) : [...x, k]))}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm font-semibold transition active:scale-95 ${on ? "animate-pop border-busy bg-busy text-white" : "border-line bg-white"}`}
                  >
                    {o.emoji} {o.label} {on && "✕"}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setTyping((t) => !t)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2.5 text-sm font-semibold ${typing ? "border-ink bg-ink text-white" : "border-dashed border-ink-faint bg-white"}`}
              >
                ✍️ Type your own
              </button>
            </div>
            {typing && (
              <div className="animate-pop">
                <input
                  autoFocus
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={200}
                  placeholder="e.g. no seafood, nothing before 9am"
                  className="w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-coral focus:ring-4 focus:ring-coral/15"
                />
                {typedMatches.length > 0 && (
                  <p className="mt-2 text-xs font-semibold text-ink-soft">
                    Got it, also skipping: {typedMatches.map((k) => `${VETO_BY_KEY[k].emoji} ${VETO_BY_KEY[k].label}`).join(", ")}
                  </p>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="button" disabled={busy} onClick={() => finish(true)} className={buttonClass("ghost")}>
                Nothing, I&apos;m easy
              </button>
              <button type="button" disabled={busy} onClick={() => finish(false)} className={buttonClass("primary")}>
                {busy ? "Saving…" : "Done ✓"}
              </button>
            </div>
          </div>
        )}
      </div>

      {error && <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}

      {step < 3 && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/90 backdrop-blur">
          <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
            {step > 0 ? (
              <button type="button" onClick={() => setStep((s) => s - 1)} className={`${buttonClass("ghost")} px-4`}>
                ←
              </button>
            ) : (
              <Link href={`/t/${p.slug}/${p.memberId}`} className={`${buttonClass("ghost")} px-4`}>
                ✕
              </Link>
            )}
            <button type="button" disabled={!canNext || busy} onClick={next} className={`${buttonClass("primary")} flex-1`}>
              {canNext ? "Next" : ["Answer every date", queue.length ? "Swipe all the ideas" : "Like at least one", "Pick a budget", ""][step]}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function IdeaCard({ idea }: { idea: Idea }) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-line bg-white shadow-card">
      <div className="relative bg-sunset px-5 pt-6 pb-5 text-white">
        <span className="absolute top-4 right-4 text-6xl drop-shadow-lg">{idea.emoji}</span>
        <h3 className="mt-8 pr-16 font-display text-3xl leading-tight font-extrabold drop-shadow">{idea.destination}</h3>
        <p className="text-sm font-semibold text-white/85">{idea.region}</p>
        <span className="mt-3 inline-block rounded-full bg-white px-3 py-1 text-sm font-extrabold text-ink">≈ {inr(idea.cost_estimate)}/person</span>
      </div>
      <div className="flex flex-col gap-2 p-5">
        <p className="text-[15px]">{idea.pitch}</p>
        <ul className="flex flex-col gap-1.5">
          {idea.highlights.map((h) => (
            <li key={h} className="flex gap-2 text-sm">
              <span>✨</span>
              {h}
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-ink-faint">Just an idea for now.</p>
      </div>
    </article>
  );
}
