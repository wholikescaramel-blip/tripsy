"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

export function ConfirmButton({ slug, memberId, confirmed }: { slug: string; memberId: string; confirmed: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/t/${slug}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId, confirmed: !confirmed }),
    });
    if (!res.ok) setError((await res.json()).error);
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      {confirmed ? (
        <>
          <div className="rounded-2xl bg-free-soft px-4 py-3 text-center font-semibold text-emerald-900">✅ You&apos;re confirmed — leave sorted</div>
          <button onClick={toggle} disabled={busy} className="text-sm font-semibold text-ink-soft underline underline-offset-4">
            Oops, not sorted yet
          </button>
        </>
      ) : (
        <button onClick={toggle} disabled={busy} className={`${buttonClass("primary")} w-full text-lg`}>
          {busy ? "…" : "I'm confirmed (leave sorted) ✅"}
        </button>
      )}
      {error && <p className="text-center text-sm text-busy">{error}</p>}
    </div>
  );
}
