"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

export function NudgeButton({ slug, adminKey, memberId, kind, href }: { slug: string; adminKey: string; memberId: string; kind: string; href: string }) {
  const router = useRouter();
  const [sent, setSent] = useState(false);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        setSent(true);
        void fetch(`/api/t/${slug}/nudges`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ adminKey, memberId, kind }),
        }).then(() => setTimeout(() => router.refresh(), 800));
      }}
      className={`${buttonClass(sent ? "ghost" : "free")} shrink-0 px-4 py-2.5 text-sm`}
    >
      {sent ? "Sent ✓" : "💬 Send nudge"}
    </a>
  );
}

export function FreshPlansButton({ slug, adminKey, label = "🔄 Get fresh plans" }: { slug: string; adminKey: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm("Replace the current plans with 3 new ones? Swipes on the current ones are dropped.")) return;
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/t/${slug}/plans`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "fresh", adminKey }) });
          if (!res.ok) setError((await res.json()).error);
          setBusy(false);
          router.refresh();
        }}
        className={`${buttonClass("ghost")} w-full text-sm`}
      >
        {busy ? "Cooking…" : label}
      </button>
      {error && <p className="mt-2 text-center text-sm text-busy">{error}</p>}
    </div>
  );
}

export function CopyLink({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        await navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold"
    >
      {copied ? "Copied ✓" : label}
    </button>
  );
}

export function StartPlanningButton({ slug, adminKey }: { slug: string; adminKey: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm("Everyone's here? Plans will be made from the people who've joined so far. Anyone who joins later is assumed free until they answer.")) return;
          setBusy(true);
          setError(null);
          const res = await fetch(`/api/t/${slug}/plans`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: "start", adminKey }) });
          if (!res.ok) setError((await res.json()).error);
          setBusy(false);
          router.refresh();
        }}
        className={`${buttonClass("primary")} w-full text-sm`}
      >
        {busy ? "Cooking up plans…" : "🚀 Everyone's here — start planning"}
      </button>
      {error && <p className="mt-2 text-center text-sm font-semibold text-busy">{error}</p>}
    </div>
  );
}
