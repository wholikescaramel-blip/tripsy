"use client";

import { useRef } from "react";
import type { DayStatus } from "@/lib/types";
import { fmtMonth, monthDays, weekday } from "@/lib/time";

export type Brush = DayStatus | "clear";

const STYLE: Record<DayStatus, string> = {
  free: "bg-free text-white shadow-[0_6px_14px_-6px_rgb(16_185_129/0.7)]",
  maybe: "bg-maybe text-white shadow-[0_6px_14px_-6px_rgb(245_158_11/0.7)]",
  busy: "bg-busy-soft text-rose-400 line-through",
};

export const BRUSHES: { key: Brush; label: string; emoji: string; cls: string }[] = [
  { key: "free", label: "Free", emoji: "✅", cls: "bg-free text-white" },
  { key: "maybe", label: "Maybe", emoji: "🤔", cls: "bg-maybe text-white" },
  { key: "busy", label: "Not free", emoji: "❌", cls: "bg-busy text-white" },
  { key: "clear", label: "Erase", emoji: "🧽", cls: "bg-ink text-white" },
];

/** Month grid you can tap or drag across ("paint") to mark days. */
export function Calendar({
  month,
  value,
  onChange,
  brush,
  readOnly,
}: {
  month: string;
  value: Record<string, DayStatus>;
  onChange: (next: Record<string, DayStatus>) => void;
  brush: Brush;
  readOnly?: boolean;
}) {
  const days = monthDays(month);
  const lead = (weekday(days[0]) + 6) % 7; // Monday-first
  const stroke = useRef<{ mode: Brush; touched: Set<string>; next: Record<string, DayStatus> } | null>(null);

  const apply = (day: string) => {
    const s = stroke.current;
    if (!s || s.touched.has(day)) return;
    s.touched.add(day);
    if (s.mode === "clear") delete s.next[day];
    else s.next[day] = s.mode;
    onChange({ ...s.next });
  };

  const dayAt = (x: number, y: number) => (document.elementFromPoint(x, y) as HTMLElement | null)?.closest<HTMLElement>("[data-day]")?.dataset.day;

  return (
    <div>
      <p className="mb-2 text-center font-display font-bold">{fmtMonth(month)}</p>
      <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold text-ink-faint">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <div
        className="grid touch-none grid-cols-7 gap-1.5 select-none"
        onPointerDown={(e) => {
          if (readOnly) return;
          const day = dayAt(e.clientX, e.clientY);
          if (!day) return;
          // Tapping a day that already has this status erases it (toggle).
          const mode: Brush = brush !== "clear" && value[day] === brush ? "clear" : brush;
          stroke.current = { mode, touched: new Set(), next: { ...value } };
          apply(day);
        }}
        onPointerMove={(e) => {
          if (!stroke.current) return;
          const day = dayAt(e.clientX, e.clientY);
          if (day) apply(day);
        }}
        onPointerUp={() => (stroke.current = null)}
        onPointerCancel={() => (stroke.current = null)}
        onPointerLeave={() => (stroke.current = null)}
      >
        {Array.from({ length: lead }, (_, i) => (
          <span key={`lead-${i}`} />
        ))}
        {days.map((day) => {
          const s = value[day];
          const weekend = [0, 6].includes(weekday(day));
          return (
            <button
              type="button"
              key={day}
              data-day={day}
              className={`flex aspect-square items-center justify-center rounded-xl text-sm font-bold transition-all duration-150 ${
                s ? STYLE[s] : weekend ? "bg-sand text-ink" : "bg-white text-ink border border-line"
              } ${s === "free" || s === "maybe" ? "scale-[1.03]" : ""}`}
            >
              {Number(day.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
