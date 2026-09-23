import Link from "next/link";
import { notFound } from "next/navigation";
import { SwipeDeck } from "@/components/SwipeDeck";
import { Empty } from "@/components/ui";
import { tripPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

export default async function SwipePage({ params }: PageProps<"/t/[slug]/[memberId]/swipe">) {
  const { slug, memberId } = await params;
  const { view } = await tripPage(slug);
  const me = view.members.find((m) => m.id === memberId);
  if (!me) notFound();
  const open = view.trip.status === "voting" || view.trip.status === "stuck";
  const plans = view.trip.status === "stuck" ? [...view.currentPlans, ...view.earlierPlans] : view.currentPlans;

  return (
    <main className="flex flex-col gap-4 pt-6">
      <div className="flex items-center justify-between">
        <Link href={`/t/${slug}/${memberId}`} className="text-sm font-semibold text-ink-soft">
          ← Trip
        </Link>
        {view.trip.blendRound > 0 && <span className="rounded-full bg-plum/10 px-3 py-1 text-xs font-bold text-plum">🧪 Blend round {view.trip.blendRound} of 2</span>}
      </div>
      <h1 className="font-display text-3xl font-extrabold">Would you go? 🃏</h1>
      {open && plans.length ? (
        // key: remount the deck when the set of plans changes (e.g. a blend arrives)
        <SwipeDeck key={plans.map((p) => p.id).join()} slug={slug} meId={memberId} plans={plans} members={view.members.map((m) => ({ id: m.id, name: m.name }))} />
      ) : (
        <Empty emoji="🧳" title={view.trip.status === "collecting" ? "No plans yet" : "Voting is closed"}>
          {view.trip.status === "collecting" ? "Plans appear once everyone's in (or the deadline passes)." : "Head back to the trip to see what happened."}
        </Empty>
      )}
    </main>
  );
}
