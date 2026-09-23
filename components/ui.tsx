import Link from "next/link";
import type { ReactNode } from "react";
import type { TripStatus } from "@/lib/types";

export const MEMBER_COLORS = ["#ff6b4a", "#8b5cf6", "#10b981", "#f59e0b", "#ec4899", "#3b82f6", "#14b8a6", "#ef4444"];

export function Avatar({
  name,
  index,
  size = 36,
  ring,
  dim,
  badge,
}: {
  name: string;
  index: number;
  size?: number;
  ring?: string;
  dim?: boolean;
  badge?: ReactNode;
}) {
  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <span
        className={`inline-flex h-full w-full items-center justify-center rounded-full font-display font-bold text-white ${dim ? "opacity-40 grayscale" : ""}`}
        style={{
          background: MEMBER_COLORS[index % MEMBER_COLORS.length],
          fontSize: size * 0.42,
          boxShadow: ring ? `0 0 0 3px ${ring}` : "0 0 0 2px #fff",
        }}
        title={name}
      >
        {name.slice(0, 1).toUpperCase()}
      </span>
      {badge && <span className="absolute -right-1 -bottom-1 text-[13px] leading-none">{badge}</span>}
    </span>
  );
}

export function Card({ children, className = "", tone = "white" }: { children: ReactNode; className?: string; tone?: "white" | "sand" | "ink" }) {
  const tones = {
    white: "bg-white/90 border border-line",
    sand: "bg-sand border border-line",
    ink: "bg-ink text-white",
  };
  return <section className={`rounded-3xl p-5 shadow-card backdrop-blur ${tones[tone]} ${className}`}>{children}</section>;
}

export function SectionTitle({ emoji, children, right }: { emoji?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-bold">
        {emoji && <span className="mr-1.5">{emoji}</span>}
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Pill({ children, tone = "neutral", className = "" }: { children: ReactNode; tone?: "neutral" | "free" | "maybe" | "busy" | "coral" | "plum" | "ink"; className?: string }) {
  const tones = {
    neutral: "bg-sand text-ink-soft",
    free: "bg-free-soft text-emerald-800",
    maybe: "bg-maybe-soft text-amber-800",
    busy: "bg-busy-soft text-rose-800",
    coral: "bg-coral/10 text-coral-dark",
    plum: "bg-plum/10 text-plum",
    ink: "bg-ink text-white",
  };
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function ButtonLink({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: "primary" | "ghost" | "dark"; className?: string }) {
  return (
    <Link href={href} className={`${buttonClass(variant)} ${className}`}>
      {children}
    </Link>
  );
}

export function buttonClass(variant: "primary" | "ghost" | "dark" | "free" | "busy" = "primary") {
  const base = "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-semibold transition active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none";
  const v = {
    primary: "bg-sunset text-white shadow-lift hover:brightness-105",
    ghost: "bg-white text-ink border border-line hover:bg-sand",
    dark: "bg-ink text-white hover:bg-black",
    free: "bg-free text-white hover:brightness-105",
    busy: "bg-busy text-white hover:brightness-105",
  };
  return `${base} ${v[variant]}`;
}

const STEPS: { key: string; label: string; emoji: string }[] = [
  { key: "collecting", label: "Collect", emoji: "📝" },
  { key: "voting", label: "Swipe", emoji: "🃏" },
  { key: "agreed", label: "Agreed", emoji: "🤝" },
  { key: "confirmed", label: "Locked", emoji: "🔒" },
];

export function Stepper({ status }: { status: TripStatus }) {
  const idx = status === "stuck" ? 1 : STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="flex items-center gap-1.5">
      {STEPS.map((s, i) => (
        <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
          <span
            className={`flex h-9 w-9 items-center justify-center rounded-full text-base transition ${
              i < idx ? "bg-ink text-white" : i === idx ? "bg-sunset text-white shadow-lift animate-pop" : "bg-white text-ink-faint border border-line"
            }`}
          >
            {i < idx ? "✓" : s.emoji}
          </span>
          <span className={`text-[11px] font-semibold ${i <= idx ? "text-ink" : "text-ink-faint"}`}>{s.label}</span>
        </li>
      ))}
    </ol>
  );
}

export function ProgressRing({ value, total, size = 56 }: { value: number; total: number; size?: number }) {
  const r = (size - 8) / 2;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#f1e1d4" strokeWidth={7} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke="url(#sunsetRing)"
        strokeWidth={7}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        style={{ transition: "stroke-dashoffset 0.8s ease" }}
      />
      <defs>
        <linearGradient id="sunsetRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ff9a62" />
          <stop offset="60%" stopColor="#ff4d7d" />
          <stop offset="100%" stopColor="#b84ce0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Empty({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <span className="text-4xl animate-float">{emoji}</span>
      <p className="font-display text-base font-bold">{title}</p>
      {children && <div className="text-sm text-ink-soft">{children}</div>}
    </div>
  );
}
