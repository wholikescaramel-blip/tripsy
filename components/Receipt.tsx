import type { PlanView, Receipt as ReceiptData } from "@/lib/view";
import { waShare } from "@/lib/nudges";
import { fmtDateTime, fmtRange, inr } from "@/lib/time";

/** A paper-style receipt of the group decision — nobody can say "who decided this?". */
export function Receipt({ tripName, plan, receipt, tripUrl }: { tripName: string; plan: PlanView; receipt: ReceiptData; tripUrl?: string }) {
  const n = receipt.people.length;
  const confirmed = receipt.people.filter((p) => p.confirmedAt).length;
  const text = [
    `🧾 ${tripName} — decided by all ${n} of us`,
    `📍 ${plan.destination}, ${fmtRange(plan.start_date, plan.end_date)} · ≈ ${inr(plan.cost_per_person)}/person`,
    ...receipt.people.map((p) => `✅ ${p.name}${p.saidYesAt ? ` said yes ${fmtDateTime(p.saidYesAt)}` : ""}${p.confirmedAt ? " · leave sorted" : ""}`),
    receipt.agreedAt ? `🤝 Agreed ${fmtDateTime(receipt.agreedAt)}` : "",
    receipt.frozenAt ? `🔒 Locked ${fmtDateTime(receipt.frozenAt)}` : "",
    tripUrl ?? "",
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative mx-auto w-full max-w-sm bg-white px-6 pt-6 pb-8 font-mono text-[13px] text-ink shadow-card"
        style={{
          // zig-zag torn edge at the bottom
          maskImage: "linear-gradient(-45deg, transparent 8px, #000 0) bottom left / 16px 16px repeat-x, linear-gradient(#000, #000) top / 100% calc(100% - 8px) no-repeat",
          WebkitMaskImage: "linear-gradient(-45deg, transparent 8px, #000 0) bottom left / 16px 16px repeat-x, linear-gradient(#000, #000) top / 100% calc(100% - 8px) no-repeat",
        }}
      >
        <p className="text-center text-2xl">🧾</p>
        <p className="mt-1 text-center font-display text-lg font-extrabold tracking-wide uppercase">Trip receipt</p>
        <p className="text-center text-xs text-ink-soft">{tripName}</p>
        <div className="my-3 border-t border-dashed border-ink/30" />
        <div className="flex justify-between gap-2">
          <span className="font-bold">{plan.destination}</span>
          <span>{fmtRange(plan.start_date, plan.end_date)}</span>
        </div>
        <div className="flex justify-between text-ink-soft">
          <span>per person (rough)</span>
          <span>≈ {inr(plan.cost_per_person)}</span>
        </div>
        <div className="my-3 border-t border-dashed border-ink/30" />
        <p className="mb-1 text-[11px] font-bold tracking-widest text-ink-soft uppercase">Decided by all {n}</p>
        <ul className="flex flex-col gap-1">
          {receipt.people.map((p) => (
            <li key={p.name} className="flex justify-between gap-2">
              <span>✅ {p.name}</span>
              <span className="text-right text-ink-soft">
                {p.saidYesAt ? fmtDateTime(p.saidYesAt) : "yes"}
                {p.confirmedAt ? " · 🔒" : ""}
              </span>
            </li>
          ))}
        </ul>
        <div className="my-3 border-t border-dashed border-ink/30" />
        <div className="flex justify-between">
          <span>Plans considered</span>
          <span>{receipt.plansConsidered}</span>
        </div>
        <div className="flex justify-between">
          <span>Changes along the way</span>
          <span>{receipt.changesAlongTheWay}</span>
        </div>
        <div className="flex justify-between">
          <span>Hard passes respected</span>
          <span>{receipt.hardPassesRespected}</span>
        </div>
        <div className="flex justify-between">
          <span>Leave sorted</span>
          <span>
            {confirmed}/{n}
          </span>
        </div>
        <div className="my-3 border-t border-dashed border-ink/30" />
        {receipt.agreedAt && <p className="text-center">🤝 Agreed {fmtDateTime(receipt.agreedAt)}</p>}
        <p className="text-center font-bold">{receipt.frozenAt ? `🔒 LOCKED ${fmtDateTime(receipt.frozenAt)}` : "⏳ Waiting for everyone to confirm"}</p>
        <p className="mt-2 text-center text-[11px] text-ink-soft">No majority rule — every single person said yes.</p>
        <div className="mt-3 flex h-8 justify-center gap-[2px]" aria-hidden>
          {Array.from({ length: 38 }, (_, i) => (
            <span key={i} className="bg-ink" style={{ width: (i * 7) % 3 === 0 ? 3 : 1 }} />
          ))}
        </div>
      </div>
      <a href={waShare(text)} target="_blank" rel="noreferrer" className="mx-auto flex w-full max-w-sm items-center justify-center rounded-2xl bg-free px-5 py-3 font-bold text-white">
        💬 Share the receipt
      </a>
    </div>
  );
}
