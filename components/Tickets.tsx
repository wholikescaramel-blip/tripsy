import type { PlanView, Receipt } from "@/lib/view";
import { waShare } from "@/lib/nudges";
import { fmtDateTime, fmtDay, fmtRange, inr } from "@/lib/time";

function hash(s: string) {
  let h = 7;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/** One vintage train ticket per traveller. Stamped CONFIRMED once they've sorted their leave. */
export function Ticket({ plan, person, index, tripName }: { plan: PlanView; person: Receipt["people"][number]; index: number; tripName: string }) {
  const h = hash(person.id);
  const no = `TX-${String(h % 9000 + 1000)}-${String(index + 1).padStart(2, "0")}`;
  const seat = `${(h % 60) + 1}${["W", "A", "M"][h % 3]}`;
  const coach = `C${index + 1}`;
  const confirmed = Boolean(person.confirmedAt);
  const tilt = ((h % 5) - 2) * 0.6; // every ticket sits a little crooked

  return (
    <div className="relative" style={{ transform: `rotate(${tilt}deg)` }}>
      <div className="ticket-paper relative flex overflow-hidden rounded-md shadow-[0_10px_24px_-10px_rgb(60_35_10/0.55)] ring-1 ring-[#b8955a]/60">
        {/* main part */}
        <div className="min-w-0 flex-1 px-4 pt-3 pb-4">
          <div className="flex items-center justify-between border-b border-dashed border-[#8a6a3a]/60 pb-1.5 font-typewriter text-[10px] tracking-[0.2em] uppercase">
            <span>🚂 Tripsy Express</span>
            <span>No. {no}</span>
          </div>
          <p className="mt-2 font-typewriter text-[10px] tracking-[0.25em] text-[#7a5a2e] uppercase">Passenger</p>
          <p className="font-typewriter text-xl leading-tight uppercase">{person.name}</p>
          <div className="mt-2 flex items-end gap-2 font-typewriter">
            <div className="min-w-0">
              <p className="text-[10px] tracking-[0.2em] text-[#7a5a2e] uppercase">From</p>
              <p className="truncate text-sm uppercase">{person.homeCity || "Home"}</p>
            </div>
            <span className="pb-0.5 text-lg">→</span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] tracking-[0.2em] text-[#7a5a2e] uppercase">To</p>
              <p className="truncate text-lg leading-tight font-bold uppercase">{plan.destination}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-4 gap-1 border-t border-dashed border-[#8a6a3a]/60 pt-2 font-typewriter text-[11px] uppercase">
            <div>
              <p className="text-[9px] tracking-widest text-[#7a5a2e]">Dep</p>
              <p>{fmtDay(plan.start_date)}</p>
            </div>
            <div>
              <p className="text-[9px] tracking-widest text-[#7a5a2e]">Ret</p>
              <p>{fmtDay(plan.end_date)}</p>
            </div>
            <div>
              <p className="text-[9px] tracking-widest text-[#7a5a2e]">Coach</p>
              <p>
                {coach}/{seat}
              </p>
            </div>
            <div>
              <p className="text-[9px] tracking-widest text-[#7a5a2e]">Fare</p>
              <p>≈{inr(plan.cost_per_person)}</p>
            </div>
          </div>
        </div>

        {/* tear line + stub */}
        <div className="ticket-perforation shrink-0 border-l border-dashed border-[#8a6a3a]/50" />
        <div className="flex w-16 shrink-0 flex-col items-center justify-center gap-1 px-1 py-3 font-typewriter uppercase">
          <p className="text-[9px] tracking-widest text-[#7a5a2e]">Seat</p>
          <p className="text-base">{seat}</p>
          <p className="mt-1 [writing-mode:vertical-rl] rotate-180 text-[10px] tracking-[0.3em]">Admit one</p>
          <p className="text-[9px]">{fmtDay(plan.start_date)}</p>
        </div>

        {/* rubber stamp */}
        <div
          className={`stamp pointer-events-none absolute top-[52px] right-[84px] flex flex-col items-center rounded-md border-[3px] px-2.5 py-1 text-center ${
            confirmed ? "rotate-[-14deg] border-[#b3261e] text-[#b3261e]" : "rotate-[9deg] border-[#2d5aa0] text-[#2d5aa0]"
          }`}
        >
          <span className="text-base leading-none font-bold">{confirmed ? "CONFIRMED" : "AGREED"}</span>
          <span className="text-[9px] leading-tight">{confirmed ? fmtDateTime(person.confirmedAt!) : "leave pending"}</span>
        </div>
      </div>
      <p className="sr-only">
        {tripName}: {person.name} to {plan.destination}, {fmtRange(plan.start_date, plan.end_date)}
      </p>
    </div>
  );
}

/** Everyone's tickets + the passenger manifest (the "who decided this?" proof). */
export function TicketBook({ tripName, plan, receipt, meId, tripUrl }: { tripName: string; plan: PlanView; receipt: Receipt; meId?: string; tripUrl?: string }) {
  const n = receipt.people.length;
  const confirmed = receipt.people.filter((p) => p.confirmedAt).length;
  const ordered = [...receipt.people.map((p, i) => ({ p, i }))].sort((a, b) => Number(b.p.id === meId) - Number(a.p.id === meId));
  const mine = ordered.find((x) => x.p.id === meId);
  const others = ordered.filter((x) => x.p.id !== meId);

  const text = [
    `🎟️ ${tripName} — all ${n} of us said yes`,
    `🚂 ${plan.destination}, ${fmtRange(plan.start_date, plan.end_date)} · ≈ ${inr(plan.cost_per_person)}/person`,
    ...receipt.people.map((p) => `${p.confirmedAt ? "🟥 CONFIRMED" : "🟦 agreed"} · ${p.name}${p.homeCity ? ` (from ${p.homeCity})` : ""}`),
    receipt.agreedAt ? `🤝 Agreed ${fmtDateTime(receipt.agreedAt)}` : "",
    receipt.frozenAt ? `🔒 Locked ${fmtDateTime(receipt.frozenAt)}` : "",
    tripUrl ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <section className="flex flex-col gap-4">
      <div className="text-center">
        <p className="font-typewriter text-xs tracking-[0.3em] text-ink-soft uppercase">
          {confirmed === n ? "All aboard!" : `${confirmed}/${n} tickets confirmed`}
        </p>
      </div>

      {mine && <Ticket plan={plan} person={mine.p} index={mine.i} tripName={tripName} />}
      {others.length > 0 && (
        <details open={!mine} className="group">
          <summary className="cursor-pointer list-none text-center text-sm font-semibold text-coral-dark">
            <span className="group-open:hidden">🎟️ See everyone&apos;s tickets ({others.length})</span>
            <span className="hidden group-open:inline">Everyone&apos;s tickets</span>
          </summary>
          <div className="mt-4 flex flex-col gap-4">
            {others.map(({ p, i }) => (
              <Ticket key={p.id} plan={plan} person={p} index={i} tripName={tripName} />
            ))}
          </div>
        </details>
      )}

      {/* passenger manifest */}
      <div className="ticket-paper rounded-md px-4 py-3 font-typewriter text-[12px] ring-1 ring-[#b8955a]/60">
        <p className="border-b border-dashed border-[#8a6a3a]/60 pb-1 text-center text-[11px] tracking-[0.3em] uppercase">Passenger manifest</p>
        <ul className="mt-2 flex flex-col gap-0.5">
          {receipt.people.map((p) => (
            <li key={p.id} className="flex justify-between gap-2 uppercase">
              <span>{p.name}</span>
              <span className="text-[#7a5a2e]">
                said yes {p.saidYesAt ? fmtDateTime(p.saidYesAt) : "✓"} {p.confirmedAt ? "· 🔒" : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-2 grid grid-cols-3 gap-1 border-t border-dashed border-[#8a6a3a]/60 pt-2 text-center text-[10px] uppercase">
          <div>
            <p className="text-base">{receipt.plansConsidered}</p>plans weighed
          </div>
          <div>
            <p className="text-base">{receipt.changesAlongTheWay}</p>changes
          </div>
          <div>
            <p className="text-base">{receipt.hardPassesRespected}</p>hard passes kept
          </div>
        </div>
        <p className="mt-2 border-t border-dashed border-[#8a6a3a]/60 pt-2 text-center text-[11px]">
          {receipt.agreedAt && <>Agreed {fmtDateTime(receipt.agreedAt)} · </>}
          {receipt.frozenAt ? <b>LOCKED {fmtDateTime(receipt.frozenAt)}</b> : "awaiting all confirmations"}
        </p>
        <p className="mt-1 text-center text-[10px] text-[#7a5a2e]">No majority rule — every single passenger said yes.</p>
      </div>

      <a href={waShare(text)} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center rounded-2xl bg-free px-5 py-3 font-bold text-white">
        💬 Share the tickets
      </a>
    </section>
  );
}
