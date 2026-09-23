// Common-date finder. Plain code, no Gemini.
//
// Every member gets an effective status for every day of the target month:
//   free | maybe | busy | unknown (hasn't submitted and the deadline hasn't passed yet)
// After the deadline, anyone who never submitted is treated as free on all days.
// Days left blank by someone who did submit count as "not free".

import type { AvailabilityRow, DayStatus, Member } from "./types";
import { addDays, daysBetween, monthDays } from "./time";

export type EffectiveStatus = DayStatus | "unknown";

export const MIN_WINDOW = 2;
export const MAX_WINDOW = 4;

export interface UnsureMember {
  memberId: string;
  name: string;
  days: string[];
  knownBy: string | null;
}

export interface DateWindow {
  start: string;
  end: string;
  length: number; // days in the run (may be > 4: "pick any 2–4 days inside")
  unsure: UnsureMember[]; // only for maybe windows
  missing: { memberId: string; name: string; why: "busy" | "unknown" }[]; // only for best-effort windows
  available: number;
}

export interface DatesResult {
  days: string[];
  grid: Record<string, Record<string, EffectiveStatus>>; // memberId -> day -> status
  full: DateWindow[]; // everyone free every day
  maybe: DateWindow[]; // works if the unsure people say yes
  best: DateWindow[]; // only when there are no full windows: closest options + who's missing
  waitingOn: Member[]; // not submitted yet, deadline not passed
  assumed: Member[]; // missed the deadline -> assumed free, no vetoes, average budget
}

export function effectiveGrid(
  members: Member[],
  availability: AvailabilityRow[],
  days: string[],
  deadlinePassed: boolean,
): Record<string, Record<string, EffectiveStatus>> {
  const grid: Record<string, Record<string, EffectiveStatus>> = {};
  const byMember = new Map<string, Map<string, AvailabilityRow>>();
  for (const row of availability) {
    if (!byMember.has(row.member_id)) byMember.set(row.member_id, new Map());
    byMember.get(row.member_id)!.set(row.day, row);
  }
  for (const m of members) {
    const rows = byMember.get(m.id);
    grid[m.id] = {};
    for (const day of days) {
      if (!m.submitted_at) grid[m.id][day] = deadlinePassed ? "free" : "unknown";
      else grid[m.id][day] = rows?.get(day)?.status ?? "busy";
    }
  }
  return grid;
}

export function findCommonDates(
  members: Member[],
  availability: AvailabilityRow[],
  monthStart: string,
  deadlinePassed: boolean,
): DatesResult {
  const days = monthDays(monthStart);
  const grid = effectiveGrid(members, availability, days, deadlinePassed);
  const knownBy = new Map<string, string | null>();
  for (const row of availability) {
    if (row.status === "maybe") knownBy.set(`${row.member_id}|${row.day}`, row.maybe_known_by);
  }

  // Day-level verdict across the whole group.
  const dayState = (day: string): "free" | "maybe" | "no" => {
    let sawMaybe = false;
    for (const m of members) {
      const s = grid[m.id][day];
      if (s === "busy" || s === "unknown") return "no";
      if (s === "maybe") sawMaybe = true;
    }
    return sawMaybe ? "maybe" : "free";
  };
  const states = days.map(dayState);

  const runs = (accept: (i: number) => boolean) => {
    const out: [number, number][] = [];
    let start = -1;
    for (let i = 0; i <= days.length; i++) {
      if (i < days.length && accept(i)) {
        if (start < 0) start = i;
      } else if (start >= 0) {
        if (i - start >= MIN_WINDOW) out.push([start, i - 1]);
        start = -1;
      }
    }
    return out;
  };

  const full: DateWindow[] = runs((i) => states[i] === "free").map(([a, b]) => ({
    start: days[a],
    end: days[b],
    length: b - a + 1,
    unsure: [],
    missing: [],
    available: members.length,
  }));

  const maybe: DateWindow[] = runs((i) => states[i] !== "no")
    .filter(([a, b]) => states.slice(a, b + 1).includes("maybe"))
    .map(([a, b]) => {
      const unsure: UnsureMember[] = [];
      for (const m of members) {
        const ds = days.slice(a, b + 1).filter((d) => grid[m.id][d] === "maybe");
        if (ds.length) {
          const kb = ds.map((d) => knownBy.get(`${m.id}|${d}`)).filter(Boolean) as string[];
          unsure.push({ memberId: m.id, name: m.name, days: ds, knownBy: kb.sort().at(-1) ?? null });
        }
      }
      return { start: days[a], end: days[b], length: b - a + 1, unsure, missing: [], available: members.length };
    });

  let best: DateWindow[] = [];
  if (full.length === 0) best = bestEffort(members, grid, days);

  return {
    days,
    grid,
    full,
    maybe,
    best,
    waitingOn: deadlinePassed ? [] : members.filter((m) => !m.submitted_at),
    assumed: deadlinePassed ? members.filter((m) => !m.submitted_at) : [],
  };
}

/** Top non-overlapping 2–4 day windows by how many people can make every day. */
function bestEffort(
  members: Member[],
  grid: Record<string, Record<string, EffectiveStatus>>,
  days: string[],
): DateWindow[] {
  const candidates: DateWindow[] = [];
  for (let len = MAX_WINDOW; len >= MIN_WINDOW; len--) {
    for (let i = 0; i + len <= days.length; i++) {
      const span = days.slice(i, i + len);
      const missing: DateWindow["missing"] = [];
      for (const m of members) {
        const ss = span.map((d) => grid[m.id][d]);
        if (ss.includes("busy")) missing.push({ memberId: m.id, name: m.name, why: "busy" });
        else if (ss.includes("unknown")) missing.push({ memberId: m.id, name: m.name, why: "unknown" });
      }
      candidates.push({
        start: span[0],
        end: span[len - 1],
        length: len,
        unsure: [],
        missing,
        available: members.length - missing.length,
      });
    }
  }
  // More people first, then longer windows (a 3-day trip beats a 2-day one), then earlier.
  candidates.sort((a, b) => b.available - a.available || b.length - a.length || a.start.localeCompare(b.start));
  const picked: DateWindow[] = [];
  for (const c of candidates) {
    if (c.available === 0) break;
    if (picked.some((p) => !(c.end < p.start || c.start > p.end))) continue;
    picked.push(c);
    if (picked.length === 3) break;
  }
  return picked;
}

/** Does [start, end] (2–4 days) sit inside one of the given runs? */
export function fitsInWindows(start: string, end: string, windows: DateWindow[]): DateWindow | null {
  const len = daysBetween(start, end) + 1;
  if (len < MIN_WINDOW || len > MAX_WINDOW) return null;
  return windows.find((w) => start >= w.start && end <= w.end) ?? null;
}

/** Members who are busy (or still unknown) on any day of [start, end]. */
export function blockersFor(
  start: string,
  end: string,
  members: Member[],
  grid: Record<string, Record<string, EffectiveStatus>>,
): { name: string; day: string; status: EffectiveStatus }[] {
  const out: { name: string; day: string; status: EffectiveStatus }[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) {
    for (const m of members) {
      const s = grid[m.id]?.[d];
      if (s === "busy" || s === "unknown" || s === undefined) out.push({ name: m.name, day: d, status: s ?? "busy" });
    }
  }
  return out;
}
