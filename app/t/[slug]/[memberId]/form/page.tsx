import { notFound } from "next/navigation";
import { AnswerWizard } from "@/components/AnswerWizard";
import { tripPage } from "@/lib/page-data";
import type { DayStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function FormPage({ params }: PageProps<"/t/[slug]/[memberId]/form">) {
  const { slug, memberId } = await params;
  const { bundle, view } = await tripPage(slug);
  const member = bundle.members.find((m) => m.id === memberId);
  if (!member) notFound();
  const rows = bundle.availability.filter((a) => a.member_id === memberId);
  const prefs = bundle.preferences.find((p) => p.member_id === memberId);

  return (
    <main className="pt-6 pb-8">
      <AnswerWizard
        initial={{
          slug,
          memberId,
          name: member.name,
          month: bundle.trip.target_month,
          today: view.today,
          submitted: Boolean(member.submitted_at),
          hasBudget: member.has_budget,
          frozen: bundle.trip.status === "confirmed",
          plansExist: bundle.trip.status !== "collecting",
          availability: Object.fromEntries(rows.map((r) => [r.day, r.status as DayStatus])),
          knownBy: rows.find((r) => r.status === "maybe")?.maybe_known_by ?? null,
          homeCity: prefs?.home_city ?? "",
          vibes: prefs?.vibes ?? [],
          activities: prefs?.activities ?? [],
          vetoes: prefs?.vetoes ?? [],
          vetoNotes: prefs?.veto_notes ?? "",
          wishes: prefs?.wishes ?? "",
        }}
      />
    </main>
  );
}
