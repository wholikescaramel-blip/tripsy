"use client";

import { useRef, useState, type ReactNode } from "react";

export type SwipeDir = "right" | "left";

/**
 * Drag a card left/right (touch or mouse). Past the threshold it flies off and calls onSwipe.
 * Vertical scrolling still works (touch-action: pan-y).
 */
export function Swipeable({
  children,
  onSwipe,
  yesLabel = "YES",
  noLabel = "NOPE",
  fling,
}: {
  children: ReactNode;
  onSwipe: (dir: SwipeDir) => void;
  yesLabel?: string;
  noLabel?: string;
  /** Set by the parent's buttons to animate a swipe without dragging. */
  fling?: SwipeDir | null;
}) {
  const [dx, setDx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; id: number } | null>(null);
  const done = useRef(false);

  const out = fling === "right" ? 600 : fling === "left" ? -600 : dx;
  const finish = (dir: SwipeDir) => {
    if (done.current) return;
    done.current = true;
    setDx(dir === "right" ? 600 : -600);
    setTimeout(() => onSwipe(dir), 220);
  };

  return (
    <div
      className="relative touch-pan-y select-none"
      style={{
        transform: `translateX(${out}px) rotate(${out / 18}deg)`,
        transition: dragging ? "none" : "transform 0.22s ease-out",
      }}
      onTransitionEnd={(e) => {
        if (e.target !== e.currentTarget || !fling || done.current) return;
        done.current = true;
        onSwipe(fling);
      }}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, id: e.pointerId };
      }}
      onPointerMove={(e) => {
        if (!start.current || start.current.id !== e.pointerId) return;
        const mx = e.clientX - start.current.x;
        if (Math.abs(mx) > 8) {
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          setDragging(true);
          setDx(mx);
        }
      }}
      onPointerUp={() => {
        start.current = null;
        setDragging(false);
        if (dx > 100) finish("right");
        else if (dx < -100) finish("left");
        else setDx(0);
      }}
      onPointerCancel={() => {
        start.current = null;
        setDragging(false);
        setDx(0);
      }}
    >
      <div
        className="pointer-events-none absolute top-20 left-5 z-10 -rotate-12 rounded-2xl border-4 border-free bg-white/90 px-4 py-1 font-display text-3xl font-extrabold text-free"
        style={{ opacity: Math.max(0, Math.min(1, out / 100)) }}
      >
        {yesLabel}
      </div>
      <div
        className="pointer-events-none absolute top-20 right-5 z-10 rotate-12 rounded-2xl border-4 border-busy bg-white/90 px-4 py-1 font-display text-3xl font-extrabold text-busy"
        style={{ opacity: Math.max(0, Math.min(1, -out / 100)) }}
      >
        {noLabel}
      </div>
      {children}
    </div>
  );
}

export function SwipeButtons({ onNo, onYes, disabled }: { onNo: () => void; onYes: () => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-6">
      <button
        disabled={disabled}
        onClick={onNo}
        aria-label="Nope"
        className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-white text-2xl shadow-card transition active:scale-90 disabled:opacity-50"
      >
        ✕
      </button>
      <button
        disabled={disabled}
        onClick={onYes}
        aria-label="Yes"
        className="flex h-20 w-20 items-center justify-center rounded-full bg-sunset text-3xl text-white shadow-lift transition active:scale-90 disabled:opacity-50"
      >
        ♥
      </button>
    </div>
  );
}
