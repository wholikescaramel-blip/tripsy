import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoPlanner } from "@/components/AutoPlanner";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Countdown } from "@/components/Countdown";
import { ChangeFeed, DatesPanel, LockStatus, WhoIsIn } from "@/components/Panels";
import { PlanCard } from "@/components/PlanCard";
import { RefreshOnFocus } from "@/components/RefreshOnFocus";
import { Card, SectionTitle, Stepper, buttonClass } from "@/components/ui";
import { tripPage } from "@/lib/page-data";
import { fmtDay, fmtMonth } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Hub({ params }: PageProps<"/t/[slug]/[memberId]">) {
  const { slug, memberId } = await params;
  const { view } = await tripPage(slug);
  const me = view.members.find((m) => m.id === memberId);
  if (!me) notFound();
  const status = view.trip.status;
  const others = (names: string[]) => names.filter((n) => n !== me.name);
  const toSwipe = view.currentPlans.filter((p) => !p.votes[me.id]);
  const waitingOn = view.members.filter((m) => !m.submitted && !m.assumed && m.id !== me.id).map((m) => m.name);
  const myMaybe = view.openMaybes.find((m) => m.memberId === me.id);
  const members = view.members.map((m) => ({ id: m.id, name: m.name }));

  return (
    <main className="flex flex-col gap-5 pt-6">
      <RefreshOnFocus />
      <header className="flex items-center justify-between">
        <Link href={`/t/${slug}`} className="text-sm font-semibold text-ink-soft">
          ← Switch person
        </Link>
        {status !== "confirmed" && (
          <Link href={`/t/${slug}/${me.id}/form`} className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold shadow-card">
            ✏️ {me.submitted ? "Edit my answers" : "My answers"}
          </Link>
        )}
      </header>

      <div className="animate-rise">
        <p className="font-semibold text-coral-dark">Hey {me.name} 👋</p>
        <h1 className="font-display text-3xl leading-tight font-extrabold">{view.trip.name}</h1>
        <p className="text-sm text-ink-soft">{fmtMonth(view.trip.targetMonth)}</p>
      </div>
      <Stepper status={status} />

      {myMaybe?.due && status !== "confirmed" && (
        <Link href={`/t/${slug}/${me.id}/form`} className="block rounded-3xl border-2 border-maybe bg-maybe-soft p-4 animate-pop">
          <p className="font-display text-lg font-bold">🤔 Time to update your maybe!</p>
          <p className="text-sm text-amber-900">
            You said you&apos;d know about {myMaybe.days.map((d) => fmtDay(d)).join(", ")} by {myMaybe.knownBy && fmtDay(myMaybe.knownBy)}. Yes or no?
          </p>
        </Link>
      )}

      {/* The one thing to do right now */}
      {status === "collecting" && view.readyToPlan && <AutoPlanner slug={slug} />}
      {status === "collecting" && !view.readyToPlan && !me.submitted && (
        <div className="relative overflow-hidden rounded-3xl bg-sunset p-6 text-white shadow-lift">
          <p className="absolute -top-2 -right-2 text-8xl opacity-25">🗓️</p>
          <p className="font-display text-2xl font-extrabold">Your turn! 2 minutes, tops.</p>
          <p className="mt-1 text-white/85">Mark your free days, what you&apos;d love to do and your hard no&apos;s.</p>
          {!view.deadlinePassed && (
            <p className="mt-3 text-sm font-semibold">
              ⏳ Closes in <Countdown target={view.trip.deadline} nowIso={view.now} />
            </p>
          )}
          <Link href={`/t/${slug}/${me.id}/form`} className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-white px-5 py-3.5 font-bold text-ink transition active:scale-95">
            Let&apos;s do it →
          </Link>
        </div>
      )}
      {status === "collecting" && !view.readyToPlan && me.submitted && (
        <Card tone="ink">
          <p className="text-3xl">✅</p>
          <p className="mt-2 font-display text-xl font-bold">You&apos;re in!</p>
          <p className="mt-1 text-sm text-white/70">
            {waitingOn.length
              ? `Waiting on ${waitingOn.join(", ")}. The app nudges them — you don't have to.`
              : view.dates.full.length + view.dates.maybe.length === 0
                ? "Everyone's answered, but there's no 2-day window that works for everyone yet. Check the closest dates below."
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
          <p className="mt-2 font-display text-2xl font-extrabold">
            {view.trip.blendRound > 0 ? "A blended plan is ready!" : `${toSwipe.length} plan${toSwipe.length > 1 ? "s" : ""} to swipe`}
          </p>
          <p className="mt-1 text-white/85">{view.trip.blendRound > 0 ? "It mixes the most-liked bits of each side. Swipe on it →" : "Right if you'd go, left if not. Takes a minute →"}</p>
        </Link>
      )}
      {status === "voting" && toSwipe.length === 0 && view.currentPlans.length > 0 && (
        <Card>
          <SectionTitle emoji="🗳️">You&apos;ve voted</SectionTitle>
          <p className="text-sm text-ink-soft">
            Waiting on {others([...new Set(view.currentPlans.flatMap((p) => p.pending))]).join(", ") || "the final count"}. No majority rule — if the group splits, we blend.
          </p>
          <Link href={`/t/${slug}/${me.id}/swipe`} className="mt-3 inline-block text-sm font-semibold text-coral-dark">
            Review my swipes →
          </Link>
        </Card>
      )}
      {status === "voting" && view.currentPlans.length === 0 && (
        <Card>
          <p className="text-sm text-ink-soft">No live plans right now — Riya can ask for fresh ones from the dashboard.</p>
        </Card>
      )}
      {status === "stuck" && toSwipe.length === 0 && (
        <Card>
          <SectionTitle emoji="🤝">Nearly there</SectionTitle>
          <p className="text-sm text-ink-soft">
            Two blends and still not everyone&apos;s a yes. Riya can see the closest plan and what&apos;s holding people back. You can still flip a swipe if you&apos;ve changed your mind.
          </p>
          <Link href={`/t/${slug}/${me.id}/swipe`} className="mt-3 inline-block text-sm font-semibold text-coral-dark">
            Review my swipes →
          </Link>
        </Card>
      )}

      {(status === "agreed" || status === "confirmed") && view.agreedPlan && (
        <section className="flex flex-col gap-4">
          <div className="text-center">
            <p className="text-5xl animate-float">{status === "confirmed" ? "🔒" : "🎉"}</p>
            <h2 className="mt-2 font-display text-2xl font-extrabold">{status === "confirmed" ? "It's official. Go book it!" : "Everyone said yes!"}</h2>
            <p className="text-sm text-ink-soft">{status === "confirmed" ? "Everyone's leave is sorted. The plan is frozen." : "Last step: tap below once your leave is sorted."}</p>
          </div>
          <PlanCard plan={view.agreedPlan} members={members} meId={me.id} />
          <Card>
            <SectionTitle emoji="🔐">Lock status</SectionTitle>
            <LockStatus view={view} />
            {status === "agreed" && (
              <div className="mt-4">
                <ConfirmButton slug={slug} memberId={me.id} confirmed={me.confirmed} />
                <p className="mt-2 text-center text-xs text-ink-faint">You can still edit answers — changes show up to the group with a timestamp.</p>
              </div>
            )}
          </Card>
        </section>
      )}

      <DatesPanel view={view} />
      <Card>
        <SectionTitle emoji="👯">The crew</SectionTitle>
        <WhoIsIn view={view} meId={me.id} />
      </Card>
      <ChangeFeed view={view} />
      {me.isCoordinator && (
        <p className="text-center text-sm text-ink-soft">
          You&apos;re the coordinator — your dashboard link is the one with <code>?key=</code>.
        </p>
      )}
      <div className="h-4" />
      <Link href={`/t/${slug}/${me.id}/form`} className={`${buttonClass("ghost")} ${status === "confirmed" ? "hidden" : ""}`}>
        ✏️ Change my dates or wishes
      </Link>
    </main>
  );
}
