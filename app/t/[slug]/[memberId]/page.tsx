import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoPlanner } from "@/components/AutoPlanner";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Countdown } from "@/components/Countdown";
import { ChangeFeed, DatesPanel, IdeasPanel, LockStatus, WhoIsIn } from "@/components/Panels";
import { PlanCard } from "@/components/PlanCard";
import { TicketBook } from "@/components/Tickets";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import { Card, SectionTitle, Stepper } from "@/components/ui";
import { tripPage } from "@/lib/page-data";
import { fmtDay, fmtMonth, fmtRange } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Hub({ params }: PageProps<"/t/[slug]/[memberId]">) {
  const { slug, memberId } = await params;
  const { view } = await tripPage(slug);
  const me = view.members.find((m) => m.id === memberId);
  if (!me) notFound();
  const status = view.trip.status;
  const frozen = status === "confirmed";
  const toSwipe = view.currentPlans.filter((p) => !p.votes[me.id]);
  const waitingOn = view.members.filter((m) => !m.submitted && !m.assumed && m.id !== me.id).map((m) => m.name);
  const myMaybe = view.openMaybes.find((m) => m.memberId === me.id);
  const members = view.members.map((m) => ({ id: m.id, name: m.name }));
  const nextStep = me.progress.dates < view.totals.dates ? 1 : me.progress.ideas < view.totals.ideas ? 2 : !me.progress.budget ? 3 : 4;
  const start = (step: number) => `/t/${slug}/${me.id}/start?step=${step}`;

  return (
    <main className="flex flex-col gap-5 pt-6">
      <RefreshOnFocus />
      <header className="flex items-center justify-between">
        <Link href={`/t/${slug}`} className="text-sm font-semibold text-ink-soft">
          ← Not {me.name}?
        </Link>
      </header>

      <div className="animate-rise">
        <p className="font-semibold text-coral-dark">Hey {me.name} 👋</p>
        <h1 className="font-display text-3xl leading-tight font-extrabold">{view.trip.name}</h1>
        <p className="text-sm text-ink-soft">{fmtMonth(view.trip.targetMonth)}</p>
      </div>
      <Stepper status={status} />

      {myMaybe?.due && !frozen && (
        <Link href={start(1)} className="block rounded-3xl border-2 border-maybe bg-maybe-soft p-4 animate-pop">
          <p className="font-display text-lg font-bold">🤔 Time to update your maybe!</p>
          <p className="text-sm text-amber-900">
            You said you&apos;d know about {myMaybe.ranges.map((r) => fmtRange(r.start, r.end)).join(", ")} by {myMaybe.knownBy && fmtDay(myMaybe.knownBy)}. Yes or no?
          </p>
        </Link>
      )}

      {/* The one thing to do right now */}
      {status === "collecting" && view.readyToPlan && <AutoPlanner slug={slug} />}
      {status === "collecting" && !view.readyToPlan && !me.submitted && (
        <Link href={start(nextStep)} className="relative block overflow-hidden rounded-3xl bg-sunset p-6 text-white shadow-lift transition active:scale-[0.98]">
          <p className="absolute -top-2 -right-2 text-8xl opacity-25">👆</p>
          <p className="font-display text-2xl font-extrabold">{nextStep === 1 ? "4 quick taps, 1 minute" : "Pick up where you left off"}</p>
          <p className="mt-1 text-white/85">📅 dates · 🃏 swipe ideas · 💸 budget · 🙅 hard passes</p>
          {!view.deadlinePassed && (
            <p className="mt-3 text-sm font-semibold">
              ⏳ Closes in <Countdown target={view.trip.deadline} nowIso={view.now} />
            </p>
          )}
          <span className="mt-4 flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3.5 font-bold text-ink">Let&apos;s go →</span>
        </Link>
      )}
      {status === "collecting" && !view.readyToPlan && me.submitted && (
        <Card tone="ink">
          <p className="text-3xl">✅</p>
          <p className="mt-2 font-display text-xl font-bold">You&apos;re in!</p>
          <p className="mt-1 text-sm text-white/70">
            {waitingOn.length
              ? `Waiting on ${waitingOn.join(", ")}. Tripsy will nudge them.`
              : view.dates.full.length + view.dates.maybe.length === 0
                ? "Everyone's answered, but no date works for all yet. Riya can add another date."
                : "Plans are on their way."}
          </p>
          {!view.deadlinePassed && waitingOn.length > 0 && (
            <p className="mt-3 text-sm">
              Deadline in <Countdown target={view.trip.deadline} nowIso={view.now} className="font-bold" />
            </p>
          )}
        </Card>
      )}

      {(status === "voting" || status === "stuck") && toSwipe.length > 0 && (
        <Link href={`/t/${slug}/${me.id}/swipe`} className="block rounded-3xl bg-sunset p-6 text-white shadow-lift transition active:scale-[0.98]">
          <p className="text-4xl">🃏</p>
          <p className="mt-2 font-display text-2xl font-extrabold">{view.trip.blendRound > 0 ? "A mixed plan is ready!" : `${toSwipe.length} plan${toSwipe.length > 1 ? "s" : ""} to swipe`}</p>
          <p className="mt-1 text-white/85">{view.trip.blendRound > 0 ? "The most-liked bits from both sides. Swipe on it →" : "Right if you'd go, left if not →"}</p>
        </Link>
      )}
      {view.finalPick && (
        <Link href={`/t/${slug}/${me.id}/swipe`} className="block rounded-3xl bg-sunset p-6 text-white shadow-lift transition active:scale-[0.98]">
          <p className="text-4xl">🏆</p>
          <p className="mt-2 font-display text-2xl font-extrabold">
            {view.finalPick.picks[me.id] ? "You've picked!" : `Everyone said yes to ${view.finalPick.plans.length}. Pick your favourite!`}
          </p>
          <p className="mt-1 text-white/85">
            {view.finalPick.plans.map((p) => p.destination).join(" vs ")}
            {view.finalPick.waitingOn.length ? ` · waiting on ${view.finalPick.waitingOn.join(", ")}` : ""} →
          </p>
        </Link>
      )}
      {status === "voting" && !view.finalPick && toSwipe.length === 0 && view.currentPlans.length > 0 && (
        <Card>
          <SectionTitle emoji="🗳️">You&apos;ve voted</SectionTitle>
          <p className="text-sm text-ink-soft">
            Waiting on {[...new Set(view.currentPlans.flatMap((p) => p.pending))].filter((n) => n !== me.name).join(", ") || "the final count"}. If the group splits, you get one mixed plan.
          </p>
          <Link href={`/t/${slug}/${me.id}/swipe`} className="mt-3 inline-block text-sm font-semibold text-coral-dark">
            Review my swipes →
          </Link>
        </Card>
      )}
      {status === "voting" && view.currentPlans.length === 0 && (
        <Card>
          <p className="text-sm text-ink-soft">
            {view.rejectedPlans.length === 0 ? "🧠 Making plans. Check back in a minute." : "No plans right now. Riya can ask for fresh ones."}
          </p>
        </Card>
      )}
      {status === "stuck" && !view.finalPick && toSwipe.length === 0 && (
        <Card>
          <SectionTitle emoji="🤝">Nearly there</SectionTitle>
          <p className="text-sm text-ink-soft">No plan has everyone&apos;s yes right now. You can still flip a swipe, or Riya can lock one.</p>
          <Link href={`/t/${slug}/${me.id}/swipe`} className="mt-3 inline-block text-sm font-semibold text-coral-dark">
            Review my swipes →
          </Link>
        </Card>
      )}

      {(status === "agreed" || status === "confirmed") && view.agreedPlan && (
        <section className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-5xl animate-float">{frozen ? "🔒" : "🎉"}</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold">{frozen ? "It's official. Go book it!" : view.agreedPlan.accepts.length < view.members.length ? "Locked in!" : "Everyone said yes!"}</h2>
            <p className="text-sm text-ink-soft">{frozen ? "Everyone's leave is sorted. The plan is frozen." : "Last step: tap below once your leave is sorted."}</p>
          </div>
          {view.receipt && <TicketBook tripName={view.trip.name} plan={view.agreedPlan} receipt={view.receipt} meId={me.id} />}
          <PlanCard plan={view.agreedPlan} members={members} meId={me.id} />
          <Card>
            <SectionTitle emoji="🔐">Lock status</SectionTitle>
            <LockStatus view={view} />
            {status === "agreed" && (
              <div className="mt-4">
                <ConfirmButton slug={slug} memberId={me.id} confirmed={me.confirmed} />
                <p className="mt-2 text-center text-xs text-ink-faint">You can still change answers. The group will see it.</p>
              </div>
            )}
          </Card>
        </section>
      )}

      {me.submitted && !frozen && (
        <Card>
          <SectionTitle emoji="✏️">Change your answers</SectionTitle>
          <div className="grid grid-cols-2 gap-2 text-sm font-semibold">
            <Link href={start(1)} className="rounded-2xl bg-sand px-3 py-3 text-center">
              📅 Dates
            </Link>
            <Link href={start(2)} className="rounded-2xl bg-sand px-3 py-3 text-center">
              🃏 Ideas
            </Link>
            <Link href={start(3)} className="rounded-2xl bg-sand px-3 py-3 text-center">
              💸 Budget
            </Link>
            <Link href={start(4)} className="rounded-2xl bg-sand px-3 py-3 text-center">
              🙅 Hard passes
            </Link>
          </div>
        </Card>
      )}

      <DatesPanel view={view} />
      {me.submitted && <IdeasPanel view={view} />}
      <Card>
        <SectionTitle emoji="👯">The crew</SectionTitle>
        <WhoIsIn view={view} meId={me.id} />
      </Card>
      <ChangeFeed view={view} />
    </main>
  );
}
