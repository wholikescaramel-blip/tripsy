"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { buttonClass } from "./ui";

export function NamePicker({ slug, members }: { slug: string; members: { id: string; name: string; submitted: boolean }[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [remembered, setRemembered] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    try {
      const id = localStorage.getItem(`tripsy:${slug}`);
      const m = members.find((x) => x.id === id);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading browser-only storage after mount
      if (m) setRemembered({ id: m.id, name: m.name });
    } catch {}
  }, [slug, members]);

  const go = (id: string) => {
    try {
      localStorage.setItem(`tripsy:${slug}`, id);
    } catch {}
    router.push(`/t/${slug}/${id}`);
  };

  return (
    <div className="flex flex-col gap-3">
      {remembered && (
        <button onClick={() => go(remembered.id)} className={`${buttonClass("dark")} w-full`}>
          Continue as {remembered.name} →
        </button>
      )}
      <label className="block">
        <span className="text-sm font-semibold">Who are you?</span>
        <select
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="mt-1.5 w-full appearance-none rounded-2xl border border-line bg-white px-4 py-4 text-lg font-semibold outline-none focus:border-coral focus:ring-4 focus:ring-coral/15"
        >
          <option value="">Pick your name…</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.submitted ? " ✓" : ""}
            </option>
          ))}
        </select>
      </label>
      <button disabled={!choice} onClick={() => go(choice)} className={`${buttonClass("primary")} w-full text-lg`}>
        That&apos;s me — let&apos;s go
      </button>
    </div>
  );
}
