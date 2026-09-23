"use client";

import { useEffect, useState } from "react";

/** Live countdown. `nowIso` is the server's idea of now (demo trips can time-travel). */
export function Countdown({ target, nowIso, className = "" }: { target: string; nowIso: string; className?: string }) {
  const [offset] = useState(() => Date.parse(nowIso) - Date.now());
  const [now, setNow] = useState(() => Date.parse(nowIso));
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() + offset), 1000);
    return () => clearInterval(t);
  }, [offset]);
  const diff = Date.parse(target) - now;
  if (diff <= 0) return <span className={className}>Deadline passed</span>;
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  const parts = d ? [`${d}d`, `${h}h`, `${m}m`] : [`${h}h`, `${m}m`, `${String(s).padStart(2, "0")}s`];
  return <span className={`tabular-nums ${className}`}>{parts.join(" ")}</span>;
}
