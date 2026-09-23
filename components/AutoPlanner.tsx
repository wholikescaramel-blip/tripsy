"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const LINES = ["Reading everyone's wishlists…", "Crossing out the hard no's…", "Checking budgets (privately)…", "Lining up the dates…", "Plating up 3 plans…"];

/** Once everyone's in (or the deadline passed), kick off plan generation and show a fun loader. */
export function AutoPlanner({ slug }: { slug: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [line, setLine] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const t = setInterval(() => setLine((l) => (l + 1) % LINES.length), 1400);
    fetch(`/api/t/${slug}/plans`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "auto" }) })
      .then(async (r) => {
        if (!r.ok) setError((await r.json()).error ?? "Couldn't make plans");
        router.refresh();
      })
      .finally(() => clearInterval(t));
    return () => clearInterval(t);
  }, [slug, router]);

  return (
    <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-white shadow-card">
      <div className="shimmer absolute inset-0 opacity-20" />
      <p className="text-4xl animate-wiggle">🧑‍🍳</p>
      <p className="mt-3 font-display text-xl font-bold">Everyone&apos;s in — cooking up your plans</p>
      <p className="mt-1 text-sm text-white/70">{error ?? LINES[line]}</p>
    </div>
  );
}
