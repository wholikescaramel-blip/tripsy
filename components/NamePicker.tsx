"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MEMBER_COLORS } from "./ui";

/** "Who are you?" — big name tiles. Riya added everyone, so there's nothing to type. */
export function NamePicker({ slug, members }: { slug: string; members: { id: string; name: string; submitted: boolean }[] }) {
  const router = useRouter();
  const [remembered, setRemembered] = useState<string | null>(null);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
      setRemembered(localStorage.getItem(`tripsy:${slug}`));
    } catch {}
  }, [slug]);

  const go = (m: { id: string; submitted: boolean }) => {
    try {
      localStorage.setItem(`tripsy:${slug}`, m.id);
    } catch {}
    router.push(m.submitted ? `/t/${slug}/${m.id}` : `/t/${slug}/${m.id}/start`);
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {members.map((m, i) => (
        <button
          key={m.id}
          onClick={() => go(m)}
          className={`relative flex flex-col items-center gap-2 rounded-3xl border bg-white px-3 py-5 shadow-card transition active:scale-95 ${remembered === m.id ? "border-coral ring-4 ring-coral/15" : "border-line"}`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full font-display text-2xl font-bold text-white" style={{ background: MEMBER_COLORS[i % MEMBER_COLORS.length] }}>
            {m.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="font-display text-lg font-bold">{m.name}</span>
          <span className={`text-xs font-semibold ${m.submitted ? "text-emerald-700" : "text-ink-faint"}`}>{m.submitted ? "✓ answered" : remembered === m.id ? "that's you" : "tap if this is you"}</span>
        </button>
      ))}
    </div>
  );
}
