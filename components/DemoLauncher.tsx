"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { buttonClass } from "./ui";

export function DemoLauncher({ label = "Try the demo trip", variant = "ghost" }: { label?: string; variant?: "ghost" | "primary" | "dark" }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/seed", { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Couldn't start the demo");
      setBusy(false);
      return;
    }
    router.push(`/t/${json.slug}/admin?key=${json.adminKey}`);
  }

  return (
    <div className="flex flex-col gap-2">
      <button onClick={go} disabled={busy} className={`${buttonClass(variant)} w-full`}>
        {busy ? "Packing the demo bags…" : label}
      </button>
      {error && <p className="text-center text-sm text-busy">{error}</p>}
    </div>
  );
}
