// Nudges are worked out on every dashboard load — no background jobs.

import type { AvailabilityRow, Member, NudgeLog, Plan, Swipe, Trip } from "./types";
import { fmtDay, fmtMonth, istDay } from "./time";

export type NudgeKind = "group" | "48h" | "24h" | "12h" | "maybe" | "vote" | "confirm";

export interface Nudge {
  member: Member | null; // null = goes to the group chat
  logMemberId: string; // nudge_log needs a member; group nudges are logged against the coordinator
  kind: NudgeKind;
  logKey: string; // what gets written to nudge_log once sent
  title: string;
  message: string;
  waLink: string;
  urgent: boolean;
}

/** wa.me wants digits only, with country code. Bare 10-digit numbers are assumed Indian. */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

/** Direct chat if we have their number; otherwise WhatsApp opens and Riya picks the contact. */
export function waLink(phone: string, text: string): string {
  const n = waNumber(phone);
  return n.length >= 8 ? `https://wa.me/${n}?text=${encodeURIComponent(text)}` : waShare(text);
}

/** Share link without a number: lets Riya pick the group chat. */
export function waShare(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function deadlineStage(trip: Trip, now: Date): "48h" | "24h" | "12h" | null {
  const hoursLeft = (Date.parse(trip.deadline) - now.getTime()) / 3_600_000;
  if (hoursLeft <= 0) return null;
  if (hoursLeft <= 12) return "12h";
  if (hoursLeft <= 24) return "24h";
  if (hoursLeft <= 48) return "48h";
  return null;
}

export function computeNudges(args: {
  trip: Trip;
  members: Member[];
  availability: AvailabilityRow[];
  plans: Plan[];
  swipes: Swipe[];
  nudges: NudgeLog[];
  now: Date;
  tripUrl: string;
}): { due: Nudge[]; sent: (NudgeLog & { name: string })[] } {
  const { trip, members, availability, plans, swipes, nudges, now, tripUrl } = args;
  const coordinator = members.find((m) => m.is_coordinator);
  const from = coordinator?.name ?? "Riya";
  const sentKeys = new Set(nudges.map((n) => `${n.member_id}|${n.nudge_kind}`));
  const due: Nudge[] = [];
  const month = fmtMonth(trip.target_month);

  const push = (member: Member, kind: NudgeKind, logKey: string, title: string, message: string, urgent = false) => {
    if (member.is_coordinator) return; // the coordinator is the one sending nudges
    if (sentKeys.has(`${member.id}|${logKey}`)) return;
    due.push({ member, logMemberId: member.id, kind, logKey, title, message, waLink: waLink(member.phone, message), urgent });
  };

  // 1. Deadline nudges. Friends add themselves, so first a group-chat nudge for anyone who hasn't joined…
  const stage = trip.status === "collecting" ? deadlineStage(trip, now) : null;
  const moreToJoin = trip.expected_size === null || members.length < trip.expected_size;
  if (stage && coordinator && moreToJoin && !sentKeys.has(`${coordinator.id}|group:${stage}`)) {
    const joined = members.map((m) => m.name).join(", ");
    const count = trip.expected_size ? ` (${members.length} of ${trip.expected_size})` : "";
    const left = stage === "48h" ? "2 days" : stage === "24h" ? "24 hours" : "12 hours";
    const msg = `✈️ "${trip.name}" — ${joined} ${members.length > 1 ? "are" : "is"} in${count}. ${left} left to add yourself: tap, type your name, mark your free days for ${month}. ${tripUrl}`;
    due.push({ member: null, logMemberId: coordinator.id, kind: "group", logKey: `group:${stage}`, title: `${left} left — post in the group chat`, message: msg, waLink: waShare(msg), urgent: stage === "12h" });
  }
  // …then personal nudges for people who joined but haven't filled in their answers.
  if (stage) {
    for (const m of members.filter((x) => !x.submitted_at)) {
      const link = `${tripUrl}`;
      const msg =
        stage === "48h"
          ? `Hey ${m.name}! ✈️ "${trip.name}" is coming together — we just need your dates & wishes for ${month}. Takes 2 minutes: ${link} (closes in 2 days)`
          : stage === "24h"
            ? `${m.name}, 24 hours left for "${trip.name}"! ⏳ Tap in, mark your free days and what you'd love to do: ${link}`
            : `Hey ${m.name}, it's ${from} 🙂 Honestly I'd love to not be the one chasing everyone — could you fill in your dates for "${trip.name}" tonight? Only 12 hours left and I don't want us to plan without you. ${link}`;
      push(m, stage, stage, stage === "12h" ? `12h left — personal note from ${from}` : `${stage} before deadline`, msg, stage === "12h");
    }
  }

  // 2. "Maybe" follow-ups once the day they said they'd know has arrived.
  const today = istDay(now);
  if (trip.status !== "confirmed") {
    for (const m of members) {
      const rows = availability.filter((a) => a.member_id === m.id && a.status === "maybe" && a.maybe_known_by);
      const dueRows = rows.filter((r) => r.maybe_known_by! <= today);
      if (!dueRows.length) continue;
      const knownBy = dueRows.map((r) => r.maybe_known_by!).sort()[0];
      const dayList = dueRows.map((r) => fmtDay(r.day)).slice(0, 4).join(", ");
      const msg = `Hi ${m.name}! You said you'd know about ${dayList}${dueRows.length > 4 ? "…" : ""} by ${fmtDay(knownBy)}. Can you update your maybe? 🤞 It decides our dates for "${trip.name}": ${tripUrl}`;
      push(m, "maybe", `maybe:${knownBy}`, `"Maybe" due since ${fmtDay(knownBy)}`, msg);
    }
  }

  // 3. Votes still missing on the current round.
  if (trip.status === "voting") {
    const current = plans.filter((p) => p.status === "active" && p.round === trip.blend_round);
    for (const m of members) {
      const pending = current.filter((p) => !swipes.some((s) => s.plan_id === p.id && s.member_id === m.id));
      if (!pending.length) continue;
      const what = trip.blend_round ? "the blended plan" : `${pending.length} trip plan${pending.length > 1 ? "s" : ""}`;
      push(m, "vote", `vote:${trip.blend_round}`, `Hasn't swiped ${what}`, `${m.name}! 🗳️ ${what} for "${trip.name}" ${trip.blend_round || pending.length === 1 ? "is" : "are"} waiting for your swipe — yes or no, takes 30 seconds: ${tripUrl}`);
    }
  }

  // 4. Confirmation once agreed.
  if (trip.status === "agreed") {
    for (const m of members.filter((x) => !x.confirmed_at)) {
      push(m, "confirm", `confirm:${trip.agreed_plan_id}`, "Hasn't confirmed yet", `We all agreed on "${trip.name}" 🎉 ${m.name}, tap "I'm confirmed" once your leave is sorted: ${tripUrl}`);
    }
  }

  const order: Record<NudgeKind, number> = { "12h": 0, "24h": 1, "48h": 2, group: 3, maybe: 4, vote: 5, confirm: 6 };
  due.sort((a, b) => order[a.kind] - order[b.kind]);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const sent = nudges
    .map((n) => ({ ...n, name: names.get(n.member_id) ?? "?" }))
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  return { due, sent };
}
