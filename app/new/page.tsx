import Link from "next/link";
import { CreateTripForm } from "@/components/CreateTripForm";

export const metadata = { title: "Start a trip — Tripsy" };
export const dynamic = "force-dynamic"; // default month & deadline depend on today

export default function NewTrip() {
  return (
    <main className="flex flex-col gap-5 pt-6">
      <Link href="/" className="text-sm font-semibold text-ink-soft">
        ← Back
      </Link>
      <div>
        <h1 className="font-display text-3xl font-extrabold">Start a trip 🧭</h1>
        <p className="mt-1 text-ink-soft">Two minutes of setup. After this, the app does the chasing.</p>
      </div>
      <CreateTripForm />
    </main>
  );
}
