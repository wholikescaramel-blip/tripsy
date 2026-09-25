"use client";

import Link from "next/link";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-col items-center gap-3 pt-24 text-center">
      <p className="text-5xl">🧳</p>
      <h1 className="font-display text-2xl font-extrabold">Something went wrong</h1>
      <p className="max-w-xs text-sm text-ink-soft">Usually this means the database or a key isn&apos;t set up yet.</p>
      <div className="mt-2 flex gap-2">
        <button onClick={reset} className="rounded-2xl border border-line bg-white px-4 py-3 font-semibold">
          Try again
        </button>
        <Link href="/status" className="rounded-2xl bg-ink px-4 py-3 font-semibold text-white">
          Check setup
        </Link>
      </div>
    </main>
  );
}
