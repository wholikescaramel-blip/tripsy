import type { TripView } from "@/lib/view";
import { fmtDateTime, fmtDay, fmtRange, relative } from "@/lib/time";
import { Avatar, Card, Empty, Pill, SectionTitle } from "./ui";

const VOTE_ICON = { yes: "✅", assumed: "✅", maybe: "🤔", no: "❌", pending: "…" } as const;

/** Date poll results: which options work for everyone, which depend on a maybe. */
export function DatesPanel({ view, showGrid = false }: { view: TripView; showGrid?: boolean }) {
  const { options, assumed } = view.dates;
  const n = view.members.length;
  return (
    <Card>
      <SectionTitle emoji="📅">Dates</SectionTitle>
      {assumed.length > 0 && (
        <div className="mb-3 rounded-2xl border border-maybe/40 bg-maybe-soft p-3 text-sm text-amber-900">
          <b>⏰ Not answered:</b> {assumed.map((m) => m.name).join(", ")}. We&apos;re counting them in for every date, with no hard passes and an average budget, so the trip can move on.
        </div>
      )}
      <ul className="flex flex-col gap-2">
        {options.map((o) => {
          const tone = o.works === "everyone" ? "bg-free-soft" : o.works === "maybe" ? "bg-maybe-soft" : "bg-sand";
          return (
            <li key={o.optionId} className={`rounded-2xl px-4 py-3 ${tone}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold">{fmtRange(o.start, o.end)}</span>
                <span className="text-xs font-bold">
                  {o.works === "everyone" ? "✅ everyone's in" : o.works === "maybe" ? "🤔 if the maybes say yes" : `${o.yes.length}/${n} can go`}
                </span>
              </div>
              {o.maybe.length > 0 && (
                <p className="mt-1 text-xs text-amber-900">
                  Unsure: {o.maybe.map((m) => `${m.name}${m.knownBy ? ` (knows by ${fmtDay(m.knownBy)})` : ""}`).join(", ")}
                </p>
              )}
              {o.works === "no" && (o.no.length > 0 || o.pending.length > 0) && (
                <p className="mt-1 text-xs text-ink-soft">
                  {o.no.length > 0 && <>Can&apos;t: {o.no.join(", ")}. </>}
                  {o.pending.length > 0 && <>Waiting on: {o.pending.join(", ")}.</>}
                </p>
              )}
              {showGrid && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {view.members.map((m, i) => (
                    <span key={m.id} className="flex items-center gap-1 rounded-full bg-white/80 py-0.5 pr-2 pl-0.5 text-[11px] font-semibold">
                      <Avatar name={m.name} index={i} size={18} />
                      {VOTE_ICON[o.votes[m.id] ?? "pending"]}
                    </span>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {view.dates.full.length === 0 && view.dates.maybe.length === 0 && view.members.every((m) => m.submitted || m.assumed) && (
        <p className="mt-3 text-sm font-semibold text-ink-soft">No date works for everyone yet. Riya can add another date option.</p>
      )}
    </Card>
  );
}

/** Most-liked destination ideas. */
export function IdeasPanel({ view }: { view: TripView }) {
  const ranked = [...view.ideas].sort((a, b) => b.likedBy.length - a.likedBy.length);
  return (
    <Card>
      <SectionTitle emoji="🃏">Most-liked ideas</SectionTitle>
      <ul className="flex flex-col gap-2">
        {ranked.map((i) => (
          <li key={i.id} className="flex items-center gap-3">
            <span className="text-xl">{i.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{i.destination}</p>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-sand">
                <div className="h-full rounded-full bg-sunset" style={{ width: `${(i.likedBy.length / Math.max(view.members.length, 1)) * 100}%` }} />
              </div>
            </div>
            <span className="w-10 text-right text-xs font-bold">
              {i.likedBy.length}/{view.members.length}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

export function ChangeFeed({ view, limit = 12 }: { view: TripView; limit?: number }) {
  const items = view.changes.slice(0, limit);
  return (
    <Card>
      <SectionTitle emoji="📣">What changed</SectionTitle>
      {items.length === 0 ? (
        <Empty emoji="🌱" title="Nothing yet">
          Updates show up here with a timestamp.
        </Empty>
      ) : (
        <ol className="relative flex flex-col gap-3 border-l-2 border-line pl-4">
          {items.map((c) => (
            <li key={c.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-coral ring-4 ring-white" />
              <p className="text-sm">{c.summary}</p>
              <p className="text-[11px] text-ink-faint">
                {fmtDateTime(c.created_at)} · {relative(c.created_at, new Date())}
              </p>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function StepChips({ m, totals }: { m: TripView["members"][number]; totals: TripView["totals"] }) {
  const chip = (done: boolean, label: string) => (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${done ? "bg-free-soft text-emerald-800" : "bg-sand text-ink-faint"}`}>{label}</span>
  );
  return (
    <span className="flex flex-wrap gap-1">
      {chip(m.progress.dates >= totals.dates, `📅 ${m.progress.dates}/${totals.dates}`)}
      {chip(m.progress.ideas >= totals.ideas, `🃏 ${m.progress.ideas}/${totals.ideas}`)}
      {chip(m.progress.budget, "💸")}
      {chip(m.progress.passes, "🙅")}
    </span>
  );
}

export function WhoIsIn({ view, meId }: { view: TripView; meId?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {view.members.map((m, i) => (
        <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2">
          <Avatar name={m.name} index={i} size={34} dim={!m.submitted && !m.assumed} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">
              {m.id === meId ? `${m.name} (you)` : m.name}
              {m.isCoordinator && <span className="ml-1.5 text-[11px] text-coral-dark">coordinator</span>}
            </p>
            {!m.submitted && <StepChips m={m} totals={view.totals} />}
          </div>
          {m.submitted ? <Pill tone="free">✓ in</Pill> : m.assumed ? <Pill tone="maybe">counted in</Pill> : <Pill tone="neutral">not yet</Pill>}
        </div>
      ))}
    </div>
  );
}

export function LockStatus({ view }: { view: TripView }) {
  const status = view.trip.status;
  const confirmed = view.members.filter((m) => m.confirmed).length;
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-2xl p-3 ${status === "agreed" || status === "confirmed" ? "bg-free-soft" : "bg-sand"}`}>
          <p className="text-xs font-bold text-ink-soft uppercase">Step 1 · Agreed</p>
          <p className="font-display font-bold">{status === "agreed" || status === "confirmed" ? "✓ All said yes" : "Not yet"}</p>
        </div>
        <div className={`rounded-2xl p-3 ${status === "confirmed" ? "bg-ink text-white" : "bg-sand"}`}>
          <p className={`text-xs font-bold uppercase ${status === "confirmed" ? "text-white/60" : "text-ink-soft"}`}>Step 2 · Confirmed</p>
          <p className="font-display font-bold">{status === "confirmed" ? "🔒 Frozen" : `${confirmed}/${view.members.length} leave sorted`}</p>
        </div>
      </div>
      {(status === "agreed" || status === "confirmed") && (
        <div className="flex flex-wrap gap-2">
          {view.members.map((m, i) => (
            <span key={m.id} className="flex items-center gap-1.5 rounded-full bg-white py-1 pr-3 pl-1 text-xs font-semibold border border-line">
              <Avatar name={m.name} index={i} size={22} />
              {m.confirmed ? "✅ confirmed" : "⏳ sorting leave"}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
