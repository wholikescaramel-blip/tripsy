import type { TripView } from "@/lib/view";
import { fmtDateTime, fmtDay, fmtRange, relative, weekday } from "@/lib/time";
import { Avatar, Card, Empty, Pill, SectionTitle } from "./ui";

/** Month heat-strip: how many people are free each day. */
export function GroupHeatmap({ view }: { view: TripView }) {
  const { days, grid } = view.dates;
  const n = view.members.length;
  const lead = (weekday(days[0]) + 6) % 7;
  return (
    <div>
      <div className="mb-1 grid grid-cols-7 text-center text-[10px] font-bold text-ink-faint">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <span key={i} />
        ))}
        {days.map((d) => {
          const statuses = view.members.map((m) => grid[m.id][d]);
          const free = statuses.filter((s) => s === "free").length;
          const maybe = statuses.filter((s) => s === "maybe").length;
          const everyone = free === n;
          const withMaybe = free + maybe === n && maybe > 0;
          const alpha = (free + maybe * 0.5) / n;
          return (
            <div
              key={d}
              title={`${fmtDay(d)}: ${free} free${maybe ? `, ${maybe} maybe` : ""}`}
              className={`relative flex aspect-square flex-col items-center justify-center rounded-lg text-[11px] font-bold ${everyone ? "text-white ring-2 ring-free ring-offset-1" : withMaybe ? "text-white ring-2 ring-maybe ring-offset-1" : "text-ink"}`}
              style={{ background: everyone ? "#10b981" : withMaybe ? "#f59e0b" : `rgb(16 185 129 / ${0.08 + alpha * 0.45})` }}
            >
              {Number(d.slice(8))}
              <span className="text-[8px] font-semibold opacity-80">
                {free}/{n}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex flex-wrap gap-3 text-[11px] font-semibold text-ink-soft">
        <span className="flex items-center gap-1">
          <i className="h-3 w-3 rounded bg-free" /> all free
        </span>
        <span className="flex items-center gap-1">
          <i className="h-3 w-3 rounded bg-maybe" /> all free if maybes say yes
        </span>
        <span className="flex items-center gap-1">
          <i className="h-3 w-3 rounded bg-free/30" /> some free
        </span>
      </div>
    </div>
  );
}

export function DatesPanel({ view }: { view: TripView }) {
  const { full, maybe, best, waitingOn, assumed } = view.dates;
  return (
    <Card>
      <SectionTitle emoji="📅" right={<Pill tone="neutral">2–4 day windows</Pill>}>
        Common dates
      </SectionTitle>
      {assumed.length > 0 && (
        <div className="mb-3 rounded-2xl border border-maybe/40 bg-maybe-soft p-3 text-sm text-amber-900">
          <b>⏰ Not answered yet:</b> {assumed.map((m) => m.name).join(", ")}. Until they do, we&apos;re treating them as free every day, with no
          hard no&apos;s and an average budget, so the trip can move on.
        </div>
      )}
      {waitingOn.length > 0 && (
        <p className="mb-3 text-sm text-ink-soft">
          Still waiting on <b>{waitingOn.map((m) => m.name).join(", ")}</b> — dates firm up once everyone&apos;s in.
        </p>
      )}
      <GroupHeatmap view={view} />
      <div className="mt-4 flex flex-col gap-2">
        {full.map((w) => (
          <div key={w.start} className="flex items-center justify-between rounded-2xl bg-free-soft px-4 py-3">
            <span className="font-display font-bold text-emerald-900">{fmtRange(w.start, w.end)}</span>
            <span className="text-xs font-semibold text-emerald-800">{w.length > 4 ? `${w.length} days · pick any 2–4` : `${w.length} days`} · everyone ✓</span>
          </div>
        ))}
        {maybe.map((w) => (
          <div key={`m-${w.start}`} className="rounded-2xl bg-maybe-soft px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="font-display font-bold text-amber-900">{fmtRange(w.start, w.end)}</span>
              <span className="text-xs font-semibold text-amber-800">works if maybes say yes</span>
            </div>
            <ul className="mt-1 text-xs text-amber-900">
              {w.unsure.map((u) => (
                <li key={u.memberId}>
                  🤔 {u.name} unsure on {u.days.map((d) => fmtDay(d)).join(", ")}
                  {u.knownBy ? ` — knows by ${fmtDay(u.knownBy)}` : ""}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {!full.length && !maybe.length && best.length > 0 && (
          <>
            <p className="text-sm font-semibold text-ink-soft">No window works for everyone yet. Closest options:</p>
            {best.map((w) => (
              <div key={`b-${w.start}`} className="rounded-2xl border border-line bg-white px-4 py-3">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold">{fmtRange(w.start, w.end)}</span>
                  <span className="text-xs font-semibold text-ink-soft">
                    {w.available}/{view.members.length} can make it
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-soft">
                  Missing: {w.missing.map((m) => `${m.name}${m.why === "unknown" ? " (hasn't answered)" : ""}`).join(", ")}
                </p>
              </div>
            ))}
          </>
        )}
      </div>
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

export function WhoIsIn({ view, meId }: { view: TripView; meId?: string }) {
  return (
    <div className="flex flex-col gap-2">
      {view.members.map((m, i) => (
        <div key={m.id} className="flex items-center gap-3 rounded-2xl bg-white/70 px-3 py-2">
          <Avatar name={m.name} index={i} size={34} dim={!m.submitted && !m.assumed} />
          <div className="flex-1">
            <p className="text-sm font-semibold">
              {m.id === meId ? `${m.name} (you)` : m.name}
              {m.isCoordinator && <span className="ml-1.5 text-[11px] text-coral-dark">coordinator</span>}
            </p>
            <p className="text-xs text-ink-soft">{m.homeCity ? `from ${m.homeCity}` : m.submitted ? "" : "hasn't answered yet"}</p>
          </div>
          {m.submitted ? <Pill tone="free">✓ in</Pill> : m.assumed ? <Pill tone="maybe">assumed free</Pill> : <Pill tone="neutral">waiting</Pill>}
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
