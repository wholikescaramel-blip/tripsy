"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ACTIVITIES, VETOES, VETO_GROUPS, VIBES, type Option } from "@/lib/options";
import { addDays, fmtDay, inr, monthDays, weekday } from "@/lib/time";
import type { DayStatus } from "@/lib/types";
import { BRUSHES, Calendar, type Brush } from "./Calendar";
import { buttonClass } from "./ui";

export interface WizardInitial {
  slug: string;
  memberId: string;
  name: string;
  month: string;
  today: string;
  submitted: boolean;
  hasBudget: boolean;
  frozen: boolean;
  plansExist: boolean;
  availability: Record<string, DayStatus>;
  knownBy: string | null;
  homeCity: string;
  vibes: string[];
  activities: string[];
  vetoes: string[];
  vetoNotes: string;
  wishes: string;
}

const STEPS = [
  { title: "When are you free?", emoji: "🗓️" },
  { title: "What's the dream?", emoji: "✨" },
  { title: "Your hard no's", emoji: "🙅" },
  { title: "Budget & home base", emoji: "🔒" },
  { title: "All good?", emoji: "🎉" },
];

const BUDGET_PRESETS = [
  { label: "Shoestring", emoji: "🎒", min: 5000, max: 10000 },
  { label: "Comfy", emoji: "🛏️", min: 10000, max: 20000 },
  { label: "Treat ourselves", emoji: "🥂", min: 20000, max: 35000 },
  { label: "Sky's the limit", emoji: "🚀", min: 35000, max: 60000 },
];

const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad", "Jaipur", "Kochi", "Goa", "Chandigarh", "Lucknow", "Indore"];

function Chip({ option, on, onClick, tone = "coral" }: { option: Option; on: boolean; onClick: () => void; tone?: "coral" | "busy" }) {
  const onCls = tone === "busy" ? "bg-busy text-white border-busy shadow-[0_8px_18px_-8px_rgb(244_63_94/0.8)]" : "bg-ink text-white border-ink shadow-[0_8px_18px_-8px_rgb(35_26_22/0.6)]";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm font-semibold transition active:scale-95 ${on ? `${onCls} animate-pop` : "border-line bg-white text-ink hover:border-coral/50"}`}
    >
      <span>{option.emoji}</span>
      {option.label}
      {on && tone === "busy" && <span className="text-xs">✕</span>}
    </button>
  );
}

const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((k) => k !== key) : [...list, key]);

export function AnswerWizard({ initial }: { initial: WizardInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [brush, setBrush] = useState<Brush>("free");
  const [avail, setAvail] = useState(initial.availability);
  const [knownBy, setKnownBy] = useState(initial.knownBy ?? addDays(initial.today, 7));
  const [vibes, setVibes] = useState(initial.vibes);
  const [activities, setActivities] = useState(initial.activities);
  const [wishes, setWishes] = useState(initial.wishes);
  const [vetoes, setVetoes] = useState(initial.vetoes);
  const [vetoNotes, setVetoNotes] = useState(initial.vetoNotes);
  const [homeCity, setHomeCity] = useState(initial.homeCity);
  const [budget, setBudget] = useState<{ min: number; max: number } | null>(null);
  const [editBudget, setEditBudget] = useState(!initial.hasBudget);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[] | null>(null);
  // Remember whether this was a first submission: router.refresh() updates `initial` after saving.
  const [firstTime] = useState(!initial.submitted);

  const budgetKey = `tripsy:budget:${initial.memberId}`;
  useEffect(() => {
    // Budget never comes back from the server; this device may remember it for convenience.
    try {
      const saved = localStorage.getItem(budgetKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
      if (saved) setBudget(JSON.parse(saved));
    } catch {}
  }, [budgetKey]);

  const days = monthDays(initial.month);
  const counts = useMemo(() => {
    const c = { free: 0, maybe: 0, busy: 0, unset: 0 };
    for (const d of days) c[avail[d] ?? "unset"]++;
    return c;
  }, [avail, days]);

  const quickFill = (kind: "all" | "weekends" | "clear") => {
    if (kind === "clear") return setAvail({});
    const next: Record<string, DayStatus> = { ...avail };
    for (const d of days) {
      const wk = [0, 5, 6].includes(weekday(d));
      if (kind === "all" || wk) next[d] = "free";
    }
    setAvail(next);
  };

  const canNext = [
    counts.free + counts.maybe > 0 && (counts.maybe === 0 || Boolean(knownBy)),
    vibes.length + activities.length > 0,
    true,
    Boolean(homeCity.trim()) && (!editBudget || Boolean(budget && budget.max > 0)),
    true,
  ][step];
  const hints = [
    counts.free + counts.maybe === 0 ? "Mark at least one free or maybe day" : "Tell us when you'll know about your maybes",
    "Pick at least one vibe or activity",
    "",
    !homeCity.trim() ? "Add your home city" : "Pick a budget range",
    "",
  ];

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/t/${initial.slug}/members/${initial.memberId}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        availability: Object.entries(avail).map(([day, status]) => ({ day, status, maybe_known_by: status === "maybe" ? knownBy : null })),
        home_city: homeCity,
        vibes,
        activities,
        vetoes,
        veto_notes: vetoNotes,
        wishes,
        budget: editBudget ? budget : null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) return setError(json.error);
    if (editBudget && budget) {
      try {
        localStorage.setItem(budgetKey, JSON.stringify(budget));
      } catch {}
    }
    setDone(json.changes ?? []);
    router.refresh();
  }

  if (initial.frozen) {
    return (
      <div className="rounded-3xl bg-ink p-6 text-center text-white">
        <p className="text-5xl">🔒</p>
        <p className="mt-3 font-display text-xl font-bold">The plan is frozen</p>
        <p className="mt-1 text-sm text-white/70">Everyone confirmed, so answers can&apos;t change any more. Time to book!</p>
        <Link href={`/t/${initial.slug}/${initial.memberId}`} className={`${buttonClass("primary")} mt-5 w-full`}>
          Back to the trip
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 pt-6 text-center animate-rise">
        <p className="text-7xl animate-float">🥳</p>
        <h2 className="font-display text-3xl font-extrabold">{!firstTime ? "Updated!" : `You're in, ${initial.name}!`}</h2>
        <p className="max-w-xs text-ink-soft">
          {!firstTime
            ? done.length
              ? "The group will see what changed, and any plan that no longer works gets fixed automatically."
              : "Saved. Nothing important changed."
            : "That's it. No more messages from anyone asking for your dates — we'll ping you when there's something to swipe."}
        </p>
        {done.length > 0 && (
          <ul className="w-full rounded-3xl border border-line bg-white p-4 text-left text-sm">
            {done.map((c) => (
              <li key={c} className="py-1">
                • {c}
              </li>
            ))}
          </ul>
        )}
        <Link href={`/t/${initial.slug}/${initial.memberId}`} className={`${buttonClass("primary")} w-full`}>
          See the trip →
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Progress */}
      <div>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              onClick={() => i < step && setStep(i)}
              className={`h-2 flex-1 rounded-full transition-all ${i < step ? "bg-ink" : i === step ? "bg-sunset" : "bg-line"}`}
              aria-label={s.title}
            />
          ))}
        </div>
        <p className="mt-4 text-sm font-semibold text-coral-dark">
          Step {step + 1} of {STEPS.length}
        </p>
        <h1 className="font-display text-3xl font-extrabold">
          {STEPS[step].title} <span className="inline-block animate-wiggle">{STEPS[step].emoji}</span>
        </h1>
        {initial.plansExist && step === 0 && (
          <p className="mt-2 rounded-2xl bg-maybe-soft px-3 py-2 text-xs font-semibold text-amber-900">
            Heads up: plans already exist. If your change breaks one, the group sees it and only that plan gets redone.
          </p>
        )}
      </div>

      <div key={step} className="animate-rise">
        {step === 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-ink-soft">Pick a brush, then tap or drag across days. Unmarked days count as not free.</p>
            <div className="grid grid-cols-4 gap-2">
              {BRUSHES.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  onClick={() => setBrush(b.key)}
                  className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-2.5 text-xs font-bold transition ${brush === b.key ? `${b.cls} scale-105 shadow-card` : "bg-white text-ink border border-line"}`}
                >
                  <span className="text-lg">{b.emoji}</span>
                  {b.label}
                </button>
              ))}
            </div>
            <div className="rounded-3xl border border-line bg-white p-4 shadow-card">
              <Calendar month={initial.month} value={avail} onChange={setAvail} brush={brush} />
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              <button type="button" onClick={() => quickFill("weekends")} className="rounded-full bg-white px-3 py-1.5 font-semibold border border-line">
                🗓️ Fri–Sun free
              </button>
              <button type="button" onClick={() => quickFill("all")} className="rounded-full bg-white px-3 py-1.5 font-semibold border border-line">
                🙌 Free all month
              </button>
              <button type="button" onClick={() => quickFill("clear")} className="rounded-full bg-white px-3 py-1.5 font-semibold text-ink-soft border border-line">
                Clear
              </button>
            </div>
            <div className="flex gap-2 text-xs font-semibold">
              <span className="rounded-full bg-free-soft px-2.5 py-1 text-emerald-800">{counts.free} free</span>
              <span className="rounded-full bg-maybe-soft px-2.5 py-1 text-amber-800">{counts.maybe} maybe</span>
              <span className="rounded-full bg-busy-soft px-2.5 py-1 text-rose-800">{counts.busy + counts.unset} not free</span>
            </div>
            {counts.maybe > 0 && (
              <label className="block rounded-3xl border-2 border-maybe/40 bg-maybe-soft/60 p-4 animate-pop">
                <span className="font-display font-bold">🤔 When will you know about your maybes?</span>
                <span className="mt-0.5 block text-xs text-amber-900">We&apos;ll remind you on this day — nobody has to chase you.</span>
                <input
                  type="date"
                  min={initial.today}
                  value={knownBy}
                  onChange={(e) => setKnownBy(e.target.value)}
                  className="mt-2 w-full rounded-2xl border border-maybe/40 bg-white px-4 py-3 outline-none focus:ring-4 focus:ring-maybe/20"
                />
              </label>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <p className="mb-2 text-sm font-bold text-ink-soft">What kind of trip?</p>
              <div className="flex flex-wrap gap-2">
                {VIBES.map((o) => (
                  <Chip key={o.key} option={o} on={vibes.includes(o.key)} onClick={() => setVibes((v) => toggle(v, o.key))} />
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-sm font-bold text-ink-soft">What would you love to do?</p>
              <div className="flex flex-wrap gap-2">
                {ACTIVITIES.map((o) => (
                  <Chip key={o.key} option={o} on={activities.includes(o.key)} onClick={() => setActivities((v) => toggle(v, o.key))} />
                ))}
              </div>
            </div>
            <label className="block">
              <span className="text-sm font-bold text-ink-soft">Anything you&apos;re dreaming of? (optional)</span>
              <textarea
                value={wishes}
                onChange={(e) => setWishes(e.target.value)}
                rows={2}
                placeholder="e.g. one fancy dinner, a sunrise swim, a day of doing nothing…"
                className="mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-coral focus:ring-4 focus:ring-coral/15"
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-900">
              These are absolute. No plan, vote or blend will ever include them. Skip anything you&apos;re fine with.
            </p>
            {VETO_GROUPS.map((g) => (
              <div key={g}>
                <p className="mb-2 text-sm font-bold text-ink-soft">{g}</p>
                <div className="flex flex-wrap gap-2">
                  {VETOES.filter((v) => v.group === g).map((o) => (
                    <Chip key={o.key} option={o} tone="busy" on={vetoes.includes(o.key)} onClick={() => setVetoes((v) => toggle(v, o.key))} />
                  ))}
                </div>
              </div>
            ))}
            <label className="block">
              <span className="text-sm font-bold text-ink-soft">Anything else? (comma separated)</span>
              <input
                value={vetoNotes}
                onChange={(e) => setVetoNotes(e.target.value)}
                placeholder="e.g. no seafood, nothing before 9am"
                className="mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3 outline-none focus:border-coral focus:ring-4 focus:ring-coral/15"
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <label className="block">
              <span className="text-sm font-bold text-ink-soft">🏠 Where are you travelling from?</span>
              <input
                list="cities"
                value={homeCity}
                onChange={(e) => setHomeCity(e.target.value)}
                placeholder="Your city"
                className="mt-1.5 w-full rounded-2xl border border-line bg-white px-4 py-3 text-lg outline-none focus:border-coral focus:ring-4 focus:ring-coral/15"
              />
              <datalist id="cities">
                {CITIES.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </label>

            <div className="rounded-3xl bg-ink p-5 text-white">
              <p className="font-display text-lg font-bold">💸 Budget per person, all-in</p>
              <p className="mt-1 text-sm text-white/70">
                🔒 Private. Nobody — not even {initial.name === "Riya" ? "the others" : "Riya"} — ever sees this. The group only sees whether a plan fits.
              </p>
              {!editBudget ? (
                <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                  <span className="text-sm">{budget ? `${inr(budget.min)} – ${inr(budget.max)}` : "Saved privately ✓"}</span>
                  <button type="button" onClick={() => setEditBudget(true)} className="text-sm font-semibold text-coral">
                    Change
                  </button>
                </div>
              ) : (
                <>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {BUDGET_PRESETS.map((p) => {
                      const on = budget?.min === p.min && budget?.max === p.max;
                      return (
                        <button
                          key={p.label}
                          type="button"
                          onClick={() => setBudget({ min: p.min, max: p.max })}
                          className={`rounded-2xl px-3 py-3 text-left transition ${on ? "bg-sunset shadow-lift" : "bg-white/10 hover:bg-white/15"}`}
                        >
                          <span className="text-lg">{p.emoji}</span>
                          <span className="block text-sm font-bold">{p.label}</span>
                          <span className="block text-xs text-white/70">
                            {inr(p.min)}–{inr(p.max)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between text-sm">
                      <span>Up to</span>
                      <span className="font-display text-xl font-bold">{inr(budget?.max ?? 15000)}</span>
                    </div>
                    <input
                      type="range"
                      min={3000}
                      max={80000}
                      step={500}
                      value={budget?.max ?? 15000}
                      onChange={(e) => {
                        const max = Number(e.target.value);
                        setBudget((b) => ({ min: Math.min(b?.min ?? Math.round(max * 0.6), max), max }));
                      }}
                      className="mt-2 w-full"
                    />
                    <p className="mt-1 text-xs text-white/60">Travel, stay, food and activities for the whole trip.</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            <Summary label="Free days" value={`${counts.free} free${counts.maybe ? ` · ${counts.maybe} maybe (you'll know by ${fmtDay(knownBy)})` : ""}`} onEdit={() => setStep(0)} />
            <Summary label="Vibes & activities" value={[...vibes, ...activities].map((k) => [...VIBES, ...ACTIVITIES].find((o) => o.key === k)?.emoji).join(" ") || "—"} onEdit={() => setStep(1)} />
            <Summary label="Hard no's" value={vetoes.length ? vetoes.map((k) => VETOES.find((o) => o.key === k)?.label).join(", ") + (vetoNotes ? `, ${vetoNotes}` : "") : vetoNotes || "None — you're easy!"} onEdit={() => setStep(2)} />
            <Summary label="Home & budget" value={`${homeCity} · budget ${editBudget ? "set" : "saved"} 🔒`} onEdit={() => setStep(3)} />
          </div>
        )}
      </div>

      {error && <p className="rounded-2xl bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-800">{error}</p>}

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-cream/90 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
          {step > 0 ? (
            <button type="button" onClick={() => setStep((s) => s - 1)} className={`${buttonClass("ghost")} px-4`}>
              ←
            </button>
          ) : (
            <Link href={`/t/${initial.slug}/${initial.memberId}`} className={`${buttonClass("ghost")} px-4`}>
              ✕
            </Link>
          )}
          {step < STEPS.length - 1 ? (
            <button type="button" disabled={!canNext} onClick={() => setStep((s) => s + 1)} className={`${buttonClass("primary")} flex-1`}>
              {canNext ? "Next" : hints[step]}
            </button>
          ) : (
            <button type="button" disabled={saving} onClick={save} className={`${buttonClass("primary")} flex-1`}>
              {saving ? "Saving…" : !firstTime ? "Save changes" : "Lock in my answers 🎉"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Summary({ label, value, onEdit }: { label: string; value: string; onEdit: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-3xl border border-line bg-white p-4 shadow-card">
      <div>
        <p className="text-xs font-bold tracking-wide text-ink-faint uppercase">{label}</p>
        <p className="mt-0.5 font-semibold">{value}</p>
      </div>
      <button type="button" onClick={onEdit} className="text-sm font-semibold text-coral-dark">
        Edit
      </button>
    </div>
  );
}
