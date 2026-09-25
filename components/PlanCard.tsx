import type { PlanView } from "@/lib/view";
import { fmtRange, inr, daysBetween } from "@/lib/time";
import { Avatar, Pill } from "./ui";

const GRADIENTS = [
  "linear-gradient(140deg,#ff9a62,#ff4d7d 60%,#b84ce0)",
  "linear-gradient(140deg,#34d399,#0ea5e9 70%,#6366f1)",
  "linear-gradient(140deg,#fbbf24,#f97316 55%,#e11d48)",
  "linear-gradient(140deg,#60a5fa,#8b5cf6 60%,#ec4899)",
  "linear-gradient(140deg,#2dd4bf,#10b981 50%,#84cc16)",
  "linear-gradient(140deg,#f472b6,#fb7185 50%,#f59e0b)",
];

export function planLook(p: { destination: string; tags: string[]; travel: string; activities: { title: string }[] }) {
  let h = 0;
  for (const c of p.destination) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const text = `${p.destination} ${p.activities.map((a) => a.title).join(" ")}`.toLowerCase();
  const emoji = p.tags.includes("beaches") || /beach|island|coast/.test(text)
    ? "🏖️"
    : p.tags.includes("hill_stations") || /hill|valley|tea|coffee/.test(text)
      ? "🏔️"
      : /backwater|houseboat|lake/.test(text)
        ? "🛶"
        : /palace|fort|temple|heritage/.test(text)
          ? "🏰"
          : /safari|jungle|wildlife/.test(text)
            ? "🐅"
            : /villa/.test(text)
              ? "🏡"
              : "🧭";
  return { gradient: GRADIENTS[h % GRADIENTS.length], emoji };
}

export function PlanCard({
  plan,
  members,
  meId,
  showVotes = false,
  compact = false,
}: {
  plan: PlanView;
  members: { id: string; name: string }[];
  meId?: string;
  showVotes?: boolean;
  compact?: boolean;
}) {
  const look = planLook(plan);
  const nights = daysBetween(plan.start_date, plan.end_date);
  const days = new Map<number, string[]>();
  plan.activities.filter((a) => a.day !== 0).forEach((a) => days.set(a.day ?? 1, [...(days.get(a.day ?? 1) ?? []), a.title]));
  const extras = plan.activities.filter((a) => a.day === 0).map((a) => a.title);
  const me = members.find((m) => m.id === meId);

  return (
    <article className="overflow-hidden rounded-[28px] border border-line bg-white shadow-card">
      <div className="relative px-5 pt-5 pb-6 text-white" style={{ background: look.gradient }}>
        <div className="flex items-start justify-between">
          <div className="flex flex-wrap gap-1.5">
            {plan.kind === "blend" && <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold backdrop-blur">🧪 Blend {plan.round}/2</span>}
            {plan.kind === "replacement" && <span className="rounded-full bg-white/25 px-2.5 py-1 text-xs font-bold backdrop-blur">🔁 Fixed plan</span>}
            {plan.status === "agreed" && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-ink">🤝 Agreed</span>}
          </div>
          <span className="text-5xl drop-shadow-lg">{look.emoji}</span>
        </div>
        <h3 className="mt-2 font-display text-3xl leading-tight font-extrabold drop-shadow">{plan.destination}</h3>
        <p className="text-sm font-semibold text-white/85">{plan.region}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/25 px-3 py-1 text-sm font-bold backdrop-blur">📅 {fmtRange(plan.start_date, plan.end_date)}</span>
          <span className="rounded-full bg-white/25 px-3 py-1 text-sm font-bold backdrop-blur">
            {nights + 1}D/{nights}N
          </span>
          <span className="rounded-full bg-white px-3 py-1 text-sm font-extrabold text-ink">≈ {inr(plan.cost_per_person)}/person</span>
        </div>
      </div>

      <div className="flex flex-col gap-4 p-5">
        <p className="text-[15px] text-ink">{plan.summary}</p>
        <div className="flex flex-wrap gap-1.5">
          <Pill tone="free">✓ Fits everyone&apos;s budget</Pill>
          <Pill tone="free">✓ Respects all hard no&apos;s</Pill>
          {plan.dependsOnMaybe.length > 0 && <Pill tone="maybe">🤔 Needs {plan.dependsOnMaybe.join(" & ")}&apos;s maybe</Pill>}
        </div>

        {me && plan.fit_notes[me.name] && (
          <div className="rounded-2xl bg-sand p-3">
            <p className="text-xs font-bold tracking-wide text-coral-dark uppercase">Why you&apos;ll like it</p>
            <p className="mt-0.5 font-semibold">{plan.fit_notes[me.name]}</p>
          </div>
        )}

        {!compact && (
          <>
            <div>
              <p className="mb-1.5 text-xs font-bold tracking-wide text-ink-faint uppercase">The plan</p>
              <ol className="flex flex-col gap-2">
                {[...days.entries()].map(([d, items]) => (
                  <li key={d} className="flex gap-3">
                    <span className="mt-0.5 flex h-7 w-12 shrink-0 items-center justify-center rounded-lg bg-ink text-xs font-bold text-white">Day {d}</span>
                    <span className="text-sm">{items.join(" · ")}</span>
                  </li>
                ))}
              </ol>
            </div>
            {extras.length > 0 && (
              <div className="rounded-2xl bg-sand p-3">
                <p className="mb-1.5 text-xs font-bold tracking-wide text-coral-dark uppercase">✨ More to do in {plan.destination}</p>
                <ul className="flex flex-col gap-1 text-sm">
                  {extras.map((t) => (
                    <li key={t}>• {t}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="grid gap-2 text-sm">
              <p>
                <span className="mr-1">🚆</span>
                {plan.travel}
              </p>
              <p>
                <span className="mr-1">🛏️</span>
                {plan.stay}
              </p>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-bold tracking-wide text-ink-faint uppercase">How it fits everyone</p>
              <ul className="flex flex-col gap-2">
                {members.map((m, i) =>
                  plan.fit_notes[m.name] ? (
                    <li key={m.id} className="flex items-start gap-2.5 text-sm">
                      <Avatar name={m.name} index={i} size={26} />
                      <span>
                        <b>{m.id === meId ? "You" : m.name}:</b> {plan.fit_notes[m.name]}
                      </span>
                    </li>
                  ) : null,
                )}
              </ul>
            </div>
          </>
        )}

        {showVotes && (
          <div className="flex flex-wrap gap-2 border-t border-line pt-3">
            {members.map((m, i) => {
              const v = plan.votes[m.id];
              return (
                <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-sand py-1 pr-2.5 pl-1 text-xs font-semibold">
                  <Avatar name={m.name} index={i} size={22} />
                  {v === "accept" ? "👍" : v === "decline" ? "👎" : "…"}
                </span>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-ink-faint">Rough estimate, no live prices. Booking happens after you all decide.</p>
      </div>
    </article>
  );
}
