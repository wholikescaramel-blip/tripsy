import { notFound, redirect } from "next/navigation";
import { QuickSteps } from "@/components/QuickSteps";
import { tripPage } from "@/lib/page-data";

export const dynamic = "force-dynamic";

/** The 4 quick steps: dates → idea swipes → budget → hard passes. `?step=2` jumps to one. */
export default async function StartPage({ params, searchParams }: PageProps<"/t/[slug]/[memberId]/start">) {
  const { slug, memberId } = await params;
  const { step } = await searchParams;
  const { bundle } = await tripPage(slug);
  const m = bundle.members.find((x) => x.id === memberId);
  if (!m) notFound();
  if (bundle.trip.status === "confirmed") redirect(`/t/${slug}/${memberId}`);
  const prefs = bundle.preferences.find((p) => p.member_id === memberId);

  return (
    <main className="pt-6 pb-8">
      <QuickSteps
        slug={slug}
        memberId={memberId}
        name={m.name}
        startStep={Number(step ?? 1) - 1 || 0}
        submitted={Boolean(m.submitted_at)}
        options={bundle.dateOptions.map((o) => ({ id: o.id, start: o.start_date, end: o.end_date }))}
        votes={Object.fromEntries(bundle.dateVotes.filter((v) => v.member_id === memberId).map((v) => [v.option_id, { vote: v.vote, knownBy: v.known_by }]))}
        ideas={bundle.ideas}
        ideaSwipes={Object.fromEntries(bundle.ideaSwipes.filter((s) => s.member_id === memberId).map((s) => [s.idea_id, s.liked]))}
        hasBudget={m.has_budget}
        homeCity={prefs?.home_city ?? ""}
        vetoes={prefs?.vetoes ?? []}
        vetoNotes={prefs?.veto_notes ?? ""}
      />
    </main>
  );
}
