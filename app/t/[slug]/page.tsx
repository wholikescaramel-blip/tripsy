import { Countdown } from "@/components/Countdown";
import { NamePicker } from "@/components/NamePicker";
import { Avatar, Card, ProgressRing } from "@/components/ui";
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
        <p className="text-sm font-semibold text-coral-dark">{coordinator} invited you to</p>
        <h1 className="mt-1 font-display text-4xl leading-tight font-extrabold">{view.trip.name}</h1>
        <p className="mt-2 text-ink-soft">One trip in {fmtMonth(view.trip.targetMonth)} — let&apos;s find the days that work for everyone.</p>
      </div>

      <Card className="animate-rise">
        <div className="flex items-center gap-4">
          <div className="relative">
            <ProgressRing value={done} total={view.members.length} size={64} />
            <span className="absolute inset-0 flex items-center justify-center font-display text-sm font-bold">
              {done}/{view.members.length}
            </span>
          </div>
          <div className="flex-1">
            <p className="font-semibold">{done === view.members.length ? "Everyone's in! 🎉" : `${done} of ${view.members.length} have answered`}</p>
            <p className="text-sm text-ink-soft">
              {view.deadlinePassed ? "Answers closed" : <>Closes in <Countdown target={view.trip.deadline} nowIso={view.now} className="font-semibold text-ink" /></>}
            </p>
            <p className="text-xs text-ink-faint">{fmtDateTime(view.trip.deadline)} IST</p>
          </div>
        </div>
        <div className="mt-4 flex -space-x-2">
          {view.members.map((m, i) => (
            <Avatar key={m.id} name={m.name} index={i} size={40} dim={!m.submitted} badge={m.submitted ? "✅" : undefined} />
          ))}
        </div>
      </Card>

      <Card>
        <NamePicker slug={slug} members={view.members.map((m) => ({ id: m.id, name: m.name, submitted: m.submitted }))} />
      </Card>

      <ul className="grid grid-cols-3 gap-2 text-center text-xs text-ink-soft">
        <li className="rounded-2xl bg-white/70 p-3">⏱️<br />2 minutes</li>
        <li className="rounded-2xl bg-white/70 p-3">🔒<br />Budget stays private</li>
        <li className="rounded-2xl bg-white/70 p-3">✏️<br />Edit any time</li>
      </ul>
    </main>
  );
}
