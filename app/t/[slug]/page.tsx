import { Countdown } from "@/components/Countdown";
import { NamePicker } from "@/components/NamePicker";
import { Card } from "@/components/ui";
import { tripPage } from "@/lib/page-data";
import { fmtDateTime, fmtMonth } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function TripLanding({ params }: PageProps<"/t/[slug]">) {
  const { slug } = await params;
  const { view } = await tripPage(slug);
  const done = view.members.filter((m) => m.submitted).length;
  const coordinator = view.members.find((m) => m.isCoordinator)?.name ?? "Your friend";

  return (
    <main className="flex flex-col gap-5 pt-8">
      <div className="text-center animate-rise">
        <p className="text-sm font-semibold text-coral-dark">{coordinator} is planning</p>
        <h1 className="mt-1 font-display text-4xl leading-tight font-extrabold">{view.trip.name}</h1>
        <p className="mt-2 text-ink-soft">
          {fmtMonth(view.trip.targetMonth)} · {done}/{view.members.length} answered
          {!view.deadlinePassed && (
            <>
              {" "}
              · closes in <Countdown target={view.trip.deadline} nowIso={view.now} className="font-semibold text-ink" />
            </>
          )}
        </p>
        <p className="text-xs text-ink-faint">Deadline {fmtDateTime(view.trip.deadline)} IST</p>
      </div>

      <Card>
        <p className="mb-4 text-center font-display text-xl font-bold">Who are you? 👋</p>
        <NamePicker slug={slug} members={view.members.map((m) => ({ id: m.id, name: m.name, submitted: m.submitted }))} />
      </Card>

      <ul className="grid grid-cols-3 gap-2 text-center text-xs text-ink-soft">
        <li className="rounded-2xl bg-white/70 p-3">⏱️<br />1 minute</li>
        <li className="rounded-2xl bg-white/70 p-3">👆<br />Just taps & swipes</li>
        <li className="rounded-2xl bg-white/70 p-3">🔒<br />Budget stays private</li>
      </ul>
    </main>
  );
}
