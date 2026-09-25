// Date poll: the app suggests date options, everyone taps yes / no / maybe. Plain code, no Gemini.

import type { DateOption, DateVote, DateVoteValue, Member } from "./types";
import { addDays, daysBetween, monthDays, weekday } from "./time";

export const MIN_OPTIONS = 4;

/** Every Fri–Sun weekend in the month; topped up with Sat–Mon spans so there are always ≥ 4 options. */
export function suggestDateOptions(monthStart: string): { start_date: string; end_date: string }[] {
  const days = monthDays(monthStart);
  const last = days[days.length - 1];
  const out: { start_date: string; end_date: string }[] = [];
  for (const d of days) {
    if (weekday(d) === 5 && addDays(d, 2) <= last) out.push({ start_date: d, end_date: addDays(d, 2) });
  }
  for (const d of days) {
    if (out.length >= MIN_OPTIONS) break;
    if (weekday(d) === 6 && addDays(d, 2) <= last) out.push({ start_date: d, end_date: addDays(d, 2) });
  }
  return out.sort((a, b) => a.start_date.localeCompare(b.start_date));
}

export type VoteState = DateVoteValue | "pending" | "assumed";

export interface OptionResult {
  optionId: string;
  start: string;
  end: string;
  length: number;
  addedBy: DateOption["added_by"];
  votes: Record<string, VoteState>; // memberId -> vote
  yes: string[];
  maybe: { name: string; knownBy: string | null }[];
  no: string[];
  pending: string[];
  /** everyone | if-maybes-say-yes | no */
  works: "everyone" | "maybe" | "no";
}

export interface DatesResult {
  options: OptionResult[];
  full: OptionResult[]; // everyone can go
  maybe: OptionResult[]; // works if the unsure people say yes
  best: OptionResult[]; // when nothing works for everyone: closest options
  assumed: Member[]; // missed the deadline → counted as yes to every option
}

export function dateResults(members: Member[], options: DateOption[], votes: DateVote[], assumeMissing: boolean): DatesResult {
  const results: OptionResult[] = options.map((o) => {
    const r: OptionResult = {
      optionId: o.id,
      start: o.start_date,
      end: o.end_date,
      length: daysBetween(o.start_date, o.end_date) + 1,
      addedBy: o.added_by,
      votes: {},
      yes: [],
      maybe: [],
      no: [],
      pending: [],
      works: "no",
    };
    for (const m of members) {
      const v = votes.find((x) => x.option_id === o.id && x.member_id === m.id);
      // No vote yet: once we assume (deadline passed / planning started), count it as a yes.
      const state: VoteState = v ? v.vote : assumeMissing ? "assumed" : "pending";
      r.votes[m.id] = state;
      if (state === "yes" || state === "assumed") r.yes.push(m.name);
      else if (state === "maybe") r.maybe.push({ name: m.name, knownBy: v?.known_by ?? null });
      else if (state === "no") r.no.push(m.name);
      else r.pending.push(m.name);
    }
    r.works = r.no.length || r.pending.length ? "no" : r.maybe.length ? "maybe" : "everyone";
    return r;
  });

  const full = results.filter((r) => r.works === "everyone");
  const maybe = results.filter((r) => r.works === "maybe");
  const best = full.length
    ? []
    : [...results]
        .filter((r) => r.works === "no")
        .sort((a, b) => b.yes.length + b.maybe.length - (a.yes.length + a.maybe.length) || a.start.localeCompare(b.start))
        .slice(0, 3);
  return { options: results, full, maybe, best, assumed: assumeMissing ? members.filter((m) => !m.submitted_at) : [] };
}

/** The option a plan's dates sit on (plans must use one of the voted date options). */
export function optionFor(start: string, end: string, options: OptionResult[]): OptionResult | null {
  return options.find((o) => o.start === start && o.end === end) ?? null;
}
