import { DemoLauncher } from "@/components/DemoLauncher";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { hasSupabase, isHosted } from "@/lib/config";

export const dynamic = "force-dynamic";

const STEPS = [
  { emoji: "🔗", title: "One link in the group chat", text: "Riya sets the month and a deadline. Everyone gets the same WhatsApp link." },
  { emoji: "🗓️", title: "Everyone taps in their days", text: "Free, not free or maybe — plus what they'd love, their hard no's and a private budget." },
  { emoji: "🤖", title: "The app does the chasing", text: "Timed WhatsApp nudges, auto-found common dates and 3 plans that respect every veto." },
  { emoji: "🃏", title: "Swipe, blend, lock", text: "Everyone swipes. Split? We blend the favourite bits. Then everyone confirms their leave." },
];

const POSTCARDS = [
  { emoji: "🏖️", label: "Gokarna", rot: "-rotate-6", pos: "left-0 top-6", delay: "0s" },
  { emoji: "🏔️", label: "Coorg", rot: "rotate-3", pos: "right-2 top-0", delay: "1.2s" },
  { emoji: "🛶", label: "Alleppey", rot: "rotate-6", pos: "right-8 top-36", delay: "0.6s" },
  { emoji: "🏰", label: "Udaipur", rot: "-rotate-3", pos: "left-10 top-40", delay: "1.8s" },
];

export default function Home() {
  return (
    <main className="flex flex-col gap-8 pt-6">
      <header className="flex items-center justify-between">
        <span className="font-display text-2xl font-extrabold">
          trip<span className="text-sunset">sy</span>
        </span>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-ink-soft shadow-card">for group chats 💬</span>
      </header>

      {isHosted && !hasSupabase && (
        <Link href="/status" className="rounded-2xl border-2 border-busy/40 bg-busy-soft px-4 py-3 text-sm font-semibold text-rose-900">
          ⚠️ The database isn&apos;t connected yet, so nothing can be saved. Tap to see what&apos;s missing →
        </Link>
      )}

      <section className="relative h-64">
        {POSTCARDS.map((p) => (
          <div key={p.label} className={`absolute ${p.pos}`}>
            <div className={`${p.rot} animate-float rounded-2xl bg-white p-2 pb-3 shadow-card`} style={{ animationDelay: p.delay }}>
              <div className="flex h-20 w-24 items-center justify-center rounded-xl bg-sunset text-4xl">{p.emoji}</div>
              <p className="mt-1.5 text-center text-xs font-bold">{p.label}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="animate-rise">
        <h1 className="font-display text-[2.6rem] leading-[1.02] font-extrabold">
          One trip. Five friends. <span className="text-sunset">Zero chasing.</span>
        </h1>
        <p className="mt-4 text-lg text-ink-soft">
          Everyone&apos;s dates keep changing and someone always ends up chasing. Tripsy collects, tracks, plans and decides — so the coordinator
          doesn&apos;t get blamed.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <ButtonLink href="/new" className="w-full text-lg">
          ✈️ Start a trip
        </ButtonLink>
        <DemoLauncher label="👀 Try the demo with 5 friends" />
      </section>

      <section className="flex flex-col gap-3">
        {STEPS.map((s, i) => (
          <div key={s.title} className="flex gap-4 rounded-3xl border border-line bg-white/80 p-4 shadow-card animate-rise" style={{ animationDelay: `${0.1 * i}s` }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-sand text-2xl">{s.emoji}</span>
            <div>
              <p className="font-display font-bold">{s.title}</p>
              <p className="text-sm text-ink-soft">{s.text}</p>
            </div>
          </div>
        ))}
      </section>

      <p className="text-center text-xs text-ink-faint">Rough cost estimates only — booking happens after you decide. Budgets stay private. Hard no&apos;s are absolute.</p>
    </main>
  );
}
