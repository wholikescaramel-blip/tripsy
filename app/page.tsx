import { DemoLauncher } from "@/components/DemoLauncher";
import Link from "next/link";
import { ButtonLink } from "@/components/ui";
import { hasSupabase, isHosted } from "@/lib/config";

export const dynamic = "force-dynamic";

const STEPS = [
  { emoji: "🃏", text: "Swipe right on trips you'd pick" },
  { emoji: "🏆", text: "Pick one from your top 3" },
  { emoji: "🧪", text: "Opinions split? Nothing one blended plan can't solve" },
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
          Crazy friends. Crazier trips. <span className="text-sunset">Zero chasing.</span>
        </h1>
        <p className="mt-4 font-display text-xl font-bold italic">Idhar chala mai udhar chala, jaane kaha mai kidhar chala..</p>
        <p className="mt-2 text-lg text-ink-soft">
          That&apos;s how every friend group&apos;s trip planning feels. Tripsy collects, tracks, plans and decides, so your trip gets locked in and you
          get to enjoy!
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <ButtonLink href="/new" className="w-full text-lg">
          ✈️ Start a trip
        </ButtonLink>
        <DemoLauncher label="👀 Try the demo" />
      </section>

      <section className="flex flex-col gap-2">
        {STEPS.map((s, i) => (
          <p key={s.text} className="flex items-center gap-3 font-display text-lg font-bold animate-rise" style={{ animationDelay: `${0.1 * i}s` }}>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-xl shadow-card">{s.emoji}</span>
            {s.text}
          </p>
        ))}
      </section>
    </main>
  );
}
