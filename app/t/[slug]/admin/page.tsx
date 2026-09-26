import Link from "next/link";
import { AddPerson, AdminVoteGrid, CopyLink, DateOptionControls, DeadlineControl, FreshPlansButton, NudgeButton, RemovePerson, StartPlanningButton } from "@/components/AdminBits";
import { TicketBook } from "@/components/Tickets";
import { AutoPlanner } from "@/components/AutoPlanner";
import { Countdown } from "@/components/Countdown";
import { DemoPanel } from "@/components/DemoPanel";
import { ChangeFeed, DatesPanel, IdeasPanel, LockStatus, StepChips } from "@/components/Panels";
import { PlanCard } from "@/components/PlanCard";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import { Avatar, Card, Empty, Pill, ProgressRing, SectionTitle, Stepper } from "@/components/ui";
import { timeOffsetHours } from "@/lib/clock";
import { computeNudges, groupUpdateMessage, personalNudge, waLink, waShare } from "@/lib/nudges";
import { tripPage } from "@/lib/page-data";
import { MAX_BLEND_ROUNDS } from "@/lib/service";
import { fmtDateTime, fmtDay, fmtMonth, fmtRange, inr, toIstLocal } from "@/lib/time";
import type { PlanView } from "@/lib/view";

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
  const frozen = status === "confirmed";
  const update = groupUpdateMessage({
    tripName: view.trip.name,
    status,
    blendRound: view.trip.blendRound,
    plans: view.currentPlans,
    agreed: view.agreedPlan,
    tripUrl,
  });
  const groupMsg = `✈️ ${view.trip.name}: tap the link, tap your name, say yes/no to a few dates and swipe some trip ideas for ${fmtMonth(view.trip.targetMonth)}. 1 minute! ${tripUrl}`;

  return (
    <main className="flex flex-col gap-5 pt-6">
      <RefreshOnFocus />
      <header className="rounded-3xl bg-ink p-5 text-white shadow-card">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-white/60">{coordinator?.name ?? "Coordinator"}&apos;s dashboard</p>
          <Pill tone="coral" className="!bg-white/10 !text-white">
            {status === "stuck" ? "needs a chat" : status}
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
        {status === "collecting" && <DeadlineControl slug={slug} adminKey={key} current={toIstLocal(new Date(view.trip.deadline))} />}
      </header>

      <Stepper status={status} />

      {view.trip.isDemo && <DemoPanel offsetHours={await timeOffsetHours()} links={view.members.map((m) => ({ name: m.name, href: `/t/${slug}/${m.id}` }))} />}

      {update && (
        <Card className="border-2 !border-free/40">
          <SectionTitle emoji="📣">Tell the group</SectionTitle>
          <p className="rounded-2xl bg-sand p-3 text-sm whitespace-pre-line">{update}</p>
          <a href={waShare(update)} target="_blank" rel="noreferrer" className="mt-3 flex w-full items-center justify-center rounded-2xl bg-free px-5 py-3 font-bold text-white">
            💬 Post in the group chat
          </a>
          <p className="mt-2 text-center text-xs text-ink-faint">Opens WhatsApp — pick your trip group. Anyone who still hasn&apos;t swiped shows up under nudges.</p>
        </Card>
      )}

      {status === "collecting" && view.everyoneAnswered && view.dates.full.length + view.dates.maybe.length === 0 && (
        <Card className="border-2 !border-maybe/60">
          <SectionTitle emoji="📅">Everyone&apos;s in — but no date works for all {view.members.length}</SectionTitle>
          <p className="text-sm text-ink-soft">Plans need one date option everybody can do. Closest ones:</p>
          <ul className="mt-2 flex flex-col gap-2">
            {[...view.dates.options]
              .sort((a, b) => b.yes.length + b.maybe.length - (a.yes.length + a.maybe.length))
              .slice(0, 3)
              .map((o) => (
                <li key={o.optionId} className="rounded-2xl bg-sand px-3 py-2 text-sm">
                  <b>{fmtRange(o.start, o.end)}</b> — {o.yes.length + o.maybe.length}/{view.members.length} can go
                  {o.no.length > 0 && <span className="text-ink-soft"> · can&apos;t: {o.no.join(", ")}</span>}
                </li>
              ))}
          </ul>
          <p className="mt-3 text-sm font-semibold">Fix it: add another date option below, or nudge the people who can&apos;t make it to double-check.</p>
        </Card>
      )}

      {/* 1. Nudges due now */}
      <Card className={due.length ? "border-2 !border-coral/40" : ""}>
        <SectionTitle emoji="🔔" right={due.length ? <Pill tone="coral">{due.length} due</Pill> : undefined}>
          Nudges due now
        </SectionTitle>
        {due.length === 0 ? (
          <p className="text-sm text-ink-soft">Nobody needs chasing right now. This updates every time you open the page.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {due.map((n) => (
              <li key={`${n.member.id}-${n.logKey}`} className={`rounded-2xl p-3 ${n.urgent ? "bg-coral/10" : "bg-sand"}`}>
                <div className="flex items-center gap-3">
                  <Avatar name={n.member.name} index={idx(n.member.id)} size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{n.member.name}</p>
                    <p className="text-xs font-semibold text-coral-dark">{n.title}</p>
                    {!n.member.phone.replace(/\D/g, "") && <p className="text-[11px] text-ink-faint">No number saved — you&apos;ll pick them in WhatsApp</p>}
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

      {/* 2. People */}
      <Card>
        <SectionTitle emoji="👯">People</SectionTitle>
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
                ? "Deadline passed — anyone missing is counted in for every date, no hard passes, average budget."
                : "Anyone missing gets nudged 48h, 24h and 12h before the deadline."}
          </p>
        </div>
        <ul className="flex flex-col gap-3">
          {view.members.map((m, i) => {
            const invite = personalNudge({
              name: m.name,
              from: coordinator?.name ?? "Riya",
              tripName: view.trip.name,
              status,
              submitted: m.submitted,
              swipesPending: view.currentPlans.filter((p) => !p.votes[m.id]).length,
              confirmed: m.confirmed,
              personalUrl: `${tripUrl}/${m.id}`,
            });
            return (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} index={i} size={36} dim={!m.submitted && !m.assumed} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {m.name}
                    {m.isCoordinator && <span className="ml-1 text-[11px] font-semibold text-coral-dark">you</span>}
                    {m.homeCity && <span className="ml-1 font-normal text-ink-faint">· {m.homeCity}</span>}
                  </p>
                  {m.submitted ? <span className="text-xs font-semibold text-emerald-700">✓ all done</span> : m.assumed ? <Pill tone="maybe">counted in</Pill> : <StepChips m={m} totals={view.totals} />}
                </div>
                <Link href={`/t/${slug}/${m.id}`} aria-label={`Open as ${m.name}`} title={`Open as ${m.name}`} className="shrink-0 rounded-full bg-sand px-2.5 py-1.5 text-xs font-bold">
                  👤
                </Link>
                {!m.isCoordinator && !frozen && (
                  <>
                    <a href={waLink(m.phone ?? "", invite)} target="_blank" rel="noreferrer" className="shrink-0 rounded-full bg-free-soft px-3 py-1.5 text-xs font-bold text-emerald-800">
                      💬 Nudge
                    </a>
                    <RemovePerson slug={slug} adminKey={key} memberId={m.id} name={m.name} />
                  </>
                )}
              </li>
            );
          })}
        </ul>
        {!frozen && <AddPerson slug={slug} adminKey={key} />}
      </Card>

      {/* 3. Open maybes */}
      {view.openMaybes.length > 0 && (
        <Card>
          <SectionTitle emoji="🤔">Open maybes</SectionTitle>
          <ul className="flex flex-col gap-2">
            {view.openMaybes.map((m) => (
              <li key={m.memberId} className={`flex items-start gap-3 rounded-2xl p-3 ${m.due ? "bg-maybe-soft" : "bg-sand"}`}>
                <Avatar name={m.name} index={idx(m.memberId)} size={32} />
                <div className="flex-1 text-sm">
                  <p className="font-semibold">{m.name}</p>
                  <p className="text-ink-soft">{m.ranges.map((r) => fmtRange(r.start, r.end)).join(", ")}</p>
                </div>
                <span className={`text-xs font-bold ${m.due ? "text-amber-800" : "text-ink-soft"}`}>
                  {m.knownBy ? (m.due ? `due ${fmtDay(m.knownBy)} ⚠️` : `knows by ${fmtDay(m.knownBy)}`) : "no date"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* 4. Dates */}
      <div>
        <DatesPanel view={view} />
        {!frozen && (
          <div className="px-2">
            <DateOptionControls slug={slug} adminKey={key} options={view.dates.options.map((o) => ({ id: o.optionId, label: fmtRange(o.start, o.end) }))} />
          </div>
        )}
      </div>

      {!frozen && (
        <Card>
          <SectionTitle emoji="✏️">Change answers for someone</SectionTitle>
          <AdminVoteGrid
            slug={slug}
            adminKey={key}
            members={members}
            options={view.dates.options.map((o) => ({ id: o.optionId, label: fmtRange(o.start, o.end), works: o.works, votes: o.votes }))}
          />
          <p className="mt-3 text-xs text-ink-soft">
            For anything else (ideas, budget, hard passes, plan swipes, confirming), open their page from the People list with 👤 — you can do it all as them.
          </p>
        </Card>
      )}

      <IdeasPanel view={view} />

      {/* 5. Plans & swipes */}
      <Card>
        <SectionTitle emoji="🗳️" right={status !== "collecting" && view.trip.blendRound > 0 ? <Pill tone="plum">Blend round</Pill> : undefined}>
          Plans & swipes
        </SectionTitle>
        {status === "collecting" && view.readyToPlan && <AutoPlanner slug={slug} />}
        {status === "collecting" && !view.readyToPlan && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-ink-soft">
              Plans are made automatically once everyone&apos;s answered, or when the deadline passes
              {view.dates.full.length + view.dates.maybe.length === 0 ? " — as long as one date option works for everyone." : "."}
            </p>
            {view.members.length >= 2 && <StartPlanningButton slug={slug} adminKey={key} />}
          </div>
        )}

        {status === "stuck" && view.closest && (
          <div className="mb-4 rounded-2xl border-2 border-maybe/50 bg-maybe-soft p-4">
            <p className="font-display text-lg font-bold">🤝 Closest plan: {view.closest.plan.destination}</p>
            <p className="text-sm text-amber-900">
              {view.closest.plan.accepts.length}/{view.members.length} said yes, even after the blend. No majority rule — here&apos;s who&apos;s still unhappy:
            </p>
            <ul className="mt-2 flex flex-col gap-1 text-sm">
              {view.closest.unhappy.map((u) => (
                <li key={u.name}>
                  👎 <b>{u.name}</b>: {u.reason ?? "didn't say why"}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-amber-900">Talk it through — anyone can still flip their swipe, and it locks the moment everyone says yes.</p>
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
            <summary className="cursor-pointer text-sm font-semibold text-ink-soft">Earlier plans ({view.earlierPlans.length})</summary>
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
        {status !== "collecting" && !frozen && (
          <div className="mt-4">
            <FreshPlansButton slug={slug} adminKey={key} />
          </div>
        )}
        <p className="mt-3 text-[11px] text-ink-faint">Rules: everyone must say yes · split vote → {MAX_BLEND_ROUNDS} blended plan · hard passes and budgets are never overridden.</p>
      </Card>

      {/* 6. Lock */}
      {view.agreedPlan && view.receipt && <TicketBook tripName={view.trip.name} plan={view.agreedPlan} receipt={view.receipt} tripUrl={tripUrl} />}
      {view.agreedPlan && <PlanCard plan={view.agreedPlan} members={members} showVotes compact />}
      <Card>
        <SectionTitle emoji="🔐">Lock status</SectionTitle>
        <LockStatus view={view} />
      </Card>

      <ChangeFeed view={view} limit={25} />
    </main>
  );
}

function SwipeRow({ plan, members }: { plan: PlanView; members: { id: string; name: string }[] }) {
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
