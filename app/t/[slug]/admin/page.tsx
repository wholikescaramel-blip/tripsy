import Link from "next/link";
import { CopyLink, FreshPlansButton, NudgeButton } from "@/components/AdminBits";
import { AutoPlanner } from "@/components/AutoPlanner";
import { Countdown } from "@/components/Countdown";
import { DemoPanel } from "@/components/DemoPanel";
import { ChangeFeed, DatesPanel, LockStatus } from "@/components/Panels";
import { PlanCard } from "@/components/PlanCard";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import { Avatar, Card, Empty, Pill, ProgressRing, SectionTitle, Stepper } from "@/components/ui";
import { timeOffsetHours } from "@/lib/clock";
import { computeNudges } from "@/lib/nudges";
import { tripPage } from "@/lib/page-data";
import { MAX_BLEND_ROUNDS } from "@/lib/service";
import { fmtDateTime, fmtDay, fmtMonth, fmtRange, inr, relative } from "@/lib/time";
import { waShare } from "@/lib/nudges";

export const dynamic = "force-dynamic";
export const metadata = { title: "Coordinator dashboard — Tripsy" };

export default async function Admin({ params, searchParams }: PageProps<"/t/[slug]/admin">) {
  const { slug } = await params;
  const { key } = await searchParams;
  const { bundle, view, now, tripUrl } = await tripPage(slug, { admin: true });

  if (key !== bundle.trip.admin_key) {
    return (
      <main className="pt-16">
        <Empty emoji="🔐" title="This is the coordinator's dashboard">
          You need the private link with the key.{" "}
          <Link href={`/t/${slug}`} className="font-semibold text-coral-dark underline">
            Go to the trip instead →
          </Link>
        </Empty>
      </main>
    );
  }

  const { due, sent } = computeNudges({ ...bundle, now, tripUrl });
  const coordinator = view.members.find((m) => m.isCoordinator);
  const submitted = view.members.filter((m) => m.submitted).length;
  const idx = (id: string) => view.members.findIndex((m) => m.id === id);
  const members = view.members.map((m) => ({ id: m.id, name: m.name }));
  const status = view.trip.status;
  const groupMsg = `✈️ ${view.trip.name}: tap the link, pick your name and mark your free days for ${fmtMonth(view.trip.targetMonth)}. ${tripUrl}`;

  return (
    <main className="flex flex-col gap-5 pt-6">
      <RefreshOnFocus />
      <header className="rounded-3xl bg-ink p-5 text-white shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/60">{coordinator?.name ?? "Coordinator"}&apos;s dashboard</p>
          <Pill tone="coral" className="!bg-white/10 !text-white">
            {status === "stuck" ? "needs a decision" : status}
          </Pill>
        </div>
        <h1 className="mt-1 font-display text-3xl leading-tight font-extrabold">{view.trip.name}</h1>
        <p className="text-sm text-white/70">
          {fmtMonth(view.trip.targetMonth)} · answers {view.deadlinePassed ? "closed" : "close"} {fmtDateTime(view.trip.deadline)}
          {!view.deadlinePassed && (
            <>
              {" "}
              (<Countdown target={view.trip.deadline} nowIso={view.now} />)
            </>
          )}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={waShare(groupMsg)} target="_blank" rel="noreferrer" className="rounded-full bg-free px-3 py-1.5 text-xs font-semibold">
            💬 Share to group
          </a>
          <CopyLink text={tripUrl} label="📋 Copy group link" />
          {coordinator && (
            <Link href={`/t/${slug}/${coordinator.id}`} className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold">
              🙋 My own answers
            </Link>
          )}
        </div>
      </header>

      <Stepper status={status} />

      {view.trip.isDemo && (
        <DemoPanel offsetHours={await timeOffsetHours()} links={view.members.map((m) => ({ name: m.name, href: `/t/${slug}/${m.id}` }))} />
      )}

      {/* 1. Nudges due now */}
      <Card className={due.length ? "border-2 !border-coral/40" : ""}>
        <SectionTitle emoji="🔔" right={due.length ? <Pill tone="coral">{due.length} due</Pill> : undefined}>
          Nudges due now
        </SectionTitle>
        {due.length === 0 ? (
          <p className="text-sm text-ink-soft">Nobody needs chasing right now. The app checks every time you open this page.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {due.map((n) => (
              <li key={`${n.member.id}-${n.logKey}`} className={`rounded-2xl p-3 ${n.urgent ? "bg-coral/10" : "bg-sand"}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={n.member.name} index={idx(n.member.id)} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{n.member.name}</p>
                    <p className="text-xs font-semibold text-coral-dark">{n.title}</p>
                  </div>
                  <NudgeButton slug={slug} adminKey={key} memberId={n.member.id} kind={n.logKey} href={n.waLink} />
                </div>
                <p className="mt-2 rounded-xl bg-white/70 p-2.5 text-xs text-ink-soft">&ldquo;{n.message}&rdquo;</p>
              </li>
            ))}
          </ul>
        )}
        {sent.length > 0 && (
          <details className="mt-3 text-xs text-ink-soft">
            <summary className="cursor-pointer font-semibold">Sent nudges ({sent.length})</summary>
            <ul className="mt-2 flex flex-col gap-1">
              {sent.map((s) => (
                <li key={`${s.member_id}-${s.nudge_kind}`}>
                  {s.name} · {s.nudge_kind} · {fmtDateTime(s.sent_at)}
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* 2. Who has submitted */}
      <Card>
        <SectionTitle emoji="📝">Who&apos;s in</SectionTitle>
        <div className="mb-4 flex items-center gap-4">
          <div className="relative">
            <ProgressRing value={submitted} total={view.members.length} size={60} />
            <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold">
              {submitted}/{view.members.length}
            </span>
          </div>
          <p className="text-sm text-ink-soft">
            {submitted === view.members.length
              ? "Everyone has answered 🎉"
              : view.deadlinePassed
                ? "Deadline passed — anyone missing is assumed free every day, no hard no's, average budget."
                : "Anyone missing gets nudged at 48h, 24h and 12h before the deadline."}
          </p>
        </div>
        <ul className="flex flex-col gap-2">
          {view.members.map((m, i) => (
            <li key={m.id} className="flex items-center gap-3">
              <Avatar name={m.name} index={i} size={32} dim={!m.submitted && !m.assumed} />
              <span className="flex-1 text-sm font-semibold">
                {m.name}
                {m.homeCity && <span className="ml-1 font-normal text-ink-faint">· {m.homeCity}</span>}
              </span>
              {m.submitted ? (
                <span className="text-xs text-ink-soft">updated {m.updatedAt ? relative(m.updatedAt, new Date()) : ""}</span>
              ) : m.assumed ? (
                <Pill tone="maybe">assumed free</Pill>
              ) : (
                <Pill tone="neutral">not yet</Pill>
              )}
            </li>
          ))}
        </ul>
      </Card>

      {/* 3. Open maybes */}
      <Card>
        <SectionTitle emoji="🤔">Open maybes</SectionTitle>
        {view.openMaybes.length === 0 ? (
          <p className="text-sm text-ink-soft">No open maybes.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {view.openMaybes.map((m) => (
              <li key={m.memberId} className={`flex items-start gap-3 rounded-2xl p-3 ${m.due ? "bg-maybe-soft" : "bg-sand"}`}>
                <Avatar name={m.name} index={idx(m.memberId)} size={32} />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-ink-soft">{m.days.map((d) => fmtDay(d)).join(", ")}</p>
                </div>
                <span className={`text-xs font-bold ${m.due ? "text-amber-800" : "text-ink-soft"}`}>
                  {m.knownBy ? (m.due ? `due ${fmtDay(m.knownBy)} ⚠️` : `knows by ${fmtDay(m.knownBy)}`) : "no date"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* 4. Common dates */}
      <DatesPanel view={view} />

      {/* 5. Plans & swipes */}
      <Card>
        <SectionTitle emoji="🃏" right={status !== "collecting" && <Pill tone="plum">Blend {view.trip.blendRound}/{MAX_BLEND_ROUNDS}</Pill>}>
          Plans & swipes
        </SectionTitle>
        {status === "collecting" && view.readyToPlan && <AutoPlanner slug={slug} />}
        {status === "collecting" && !view.readyToPlan && (
          <p className="text-sm text-ink-soft">
            Plans generate automatically once everyone&apos;s answered or the deadline passes
            {view.dates.full.length + view.dates.maybe.length === 0 ? " — and there's at least one 2-day window everyone can make." : "."}
          </p>
        )}

        {status === "stuck" && view.closest && (
          <div className="mb-4 rounded-2xl border-2 border-maybe/50 bg-maybe-soft p-4">
            <p className="font-display text-lg font-bold">🤝 Closest plan: {view.closest.plan.destination}</p>
            <p className="text-sm text-amber-900">
              {view.closest.plan.accepts.length}/{view.members.length} said yes after {MAX_BLEND_ROUNDS} blends. No majority rule — here&apos;s who&apos;s still unhappy:
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {view.closest.unhappy.map((u) => (
                <li key={u.name}>
                  👎 <b>{u.name}</b>: {u.reason ?? "didn't say why"}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-900">Talk it through — anyone can still flip their swipe, and it locks the moment all {view.members.length} say yes.</p>
          </div>
        )}

        {view.currentPlans.length > 0 && (
          <div className="flex flex-col gap-3">
            {view.currentPlans.map((p) => (
              <SwipeRow key={p.id} plan={p} members={view.members} />
            ))}
          </div>
        )}

        {view.earlierPlans.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft">Earlier rounds ({view.earlierPlans.length})</summary>
            <div className="mt-3 flex flex-col gap-3">
              {view.earlierPlans.map((p) => (
                <SwipeRow key={p.id} plan={p} members={view.members} />
              ))}
            </div>
          </details>
        )}

        {view.rejectedPlans.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft">Thrown out by the rules ({view.rejectedPlans.length})</summary>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {view.rejectedPlans.map((p) => (
                <li key={p.id} className="rounded-2xl bg-busy-soft/60 px-3 py-2">
                  <b>{p.destination}</b> ({fmtRange(p.start_date, p.end_date)}) — {p.status === "broken" ? "broke after a change: " : ""}
                  {p.status_reason}
                </li>
              ))}
            </ul>
          </details>
        )}

        {status !== "collecting" && status !== "confirmed" && (
          <div className="mt-4">
            <FreshPlansButton slug={slug} adminKey={key} />
          </div>
        )}
      </Card>

      {/* 6. Lock */}
      {view.agreedPlan && <PlanCard plan={view.agreedPlan} members={members} showVotes compact />}
      <Card>
        <SectionTitle emoji="🔐">Lock status</SectionTitle>
        <LockStatus view={view} />
      </Card>

      <ChangeFeed view={view} limit={25} />
    </main>
  );
}

function SwipeRow({ plan, members }: { plan: import("@/lib/view").PlanView; members: { id: string; name: string }[] }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-display font-bold">
            {plan.kind === "blend" && "🧪 "}
            {plan.kind === "replacement" && "🔁 "}
            {plan.destination}
          </p>
          <p className="text-xs text-ink-soft">
            {fmtRange(plan.start_date, plan.end_date)} · ≈ {inr(plan.cost_per_person)}/person
          </p>
        </div>
        <span className="font-display text-lg font-extrabold">
          {plan.accepts.length}
          <span className="text-sm text-ink-faint">/{members.length} 👍</span>
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {members.map((m, i) => {
          const v = plan.votes[m.id];
          return (
            <span key={m.id} className={`flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 text-xs font-semibold ${v === "accept" ? "bg-free-soft" : v === "decline" ? "bg-busy-soft" : "bg-sand"}`}>
              <Avatar name={m.name} index={i} size={20} />
              {v === "accept" ? "yes" : v === "decline" ? "no" : "…"}
            </span>
          );
        })}
      </div>
      {plan.declines.some((d) => d.reason) && (
        <ul className="mt-2 text-xs text-ink-soft">
          {plan.declines
            .filter((d) => d.reason)
            .map((d) => (
              <li key={d.name}>
                👎 {d.name}: {d.reason}
              </li>
            ))}
        </ul>
      )}
      {plan.dependsOnMaybe.length > 0 && <p className="mt-2 text-xs font-semibold text-amber-800">🤔 Depends on {plan.dependsOnMaybe.join(" & ")}&apos;s maybe</p>}
    </div>
  );
}
