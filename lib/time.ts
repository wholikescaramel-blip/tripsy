// Date helpers. Everything the group sees is in IST (UTC+05:30).

export const IST_OFFSET_MIN = 330;

/** YYYY-MM-DD for the IST calendar day containing `d`. */
export function istDay(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 10);
}

/** Parse "YYYY-MM-DDTHH:mm" typed in IST into a Date. */
export function fromIstLocal(local: string): Date {
  return new Date(`${local}:00+05:30`);
}

/** Format a Date as "YYYY-MM-DDTHH:mm" in IST (for datetime-local inputs). */
export function toIstLocal(d: Date): string {
  return new Date(d.getTime() + IST_OFFSET_MIN * 60_000).toISOString().slice(0, 16);
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** All days (YYYY-MM-DD) of the month starting at `monthStart` (YYYY-MM-01). */
export function monthDays(monthStart: string): string[] {
  const [y, m] = monthStart.split("-").map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: count }, (_, i) => `${monthStart.slice(0, 8)}${String(i + 1).padStart(2, "0")}`);
}

export function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function fmtDay(day: string, withWeekday = false): string {
  const [, m, d] = day.split("-").map(Number);
  const base = `${d} ${MONTHS[m - 1]}`;
  return withWeekday ? `${DAYS[weekday(day)]} ${base}` : base;
}

export function fmtRange(start: string, end: string): string {
  if (start === end) return fmtDay(start);
  const [, m1, d1] = start.split("-").map(Number);
  const [, m2, d2] = end.split("-").map(Number);
  if (m1 === m2) return `${d1}–${d2} ${MONTHS[m1 - 1]}`;
  return `${fmtDay(start)} – ${fmtDay(end)}`;
}

export function fmtMonth(monthStart: string): string {
  const [y, m] = monthStart.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

export function fmtDateTime(iso: string): string {
  const d = new Date(new Date(iso).getTime() + IST_OFFSET_MIN * 60_000);
  const hh = d.getUTCHours();
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}, ${h12}:${mm} ${hh < 12 ? "am" : "pm"}`;
}

/** "in 2 days", "in 5h", "3h ago"… */
export function relative(targetIso: string, now: Date): string {
  const diffMs = Date.parse(targetIso) - now.getTime();
  const abs = Math.abs(diffMs);
  const h = Math.floor(abs / 3_600_000);
  const m = Math.floor((abs % 3_600_000) / 60_000);
  let s: string;
  if (h >= 48) s = `${Math.floor(h / 24)} days`;
  else if (h >= 1) s = `${h}h${m && h < 10 ? ` ${m}m` : ""}`;
  else s = `${Math.max(m, 1)} min`;
  return diffMs >= 0 ? `in ${s}` : `${s} ago`;
}

export function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
