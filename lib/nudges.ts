// Nudges are worked out on every dashboard load — no background jobs.

import type { DateOption, DateVote, Member, NudgeLog, Plan, Swipe, Trip } from "./types";
import { fmtDay, fmtMonth, fmtRange, istDay } from "./time";

export type NudgeKind = "48h" | "24h" | "12h" | "maybe" | "vote" | "confirm";

export interface Nudge {
  member: Member;
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
  dateOptions: DateOption[];
  dateVotes: DateVote[];
  plans: Plan[];
  swipes: Swipe[];
  nudges: NudgeLog[];
  now: Date;
  tripUrl: string;
}): { due: Nudge[]; sent: (NudgeLog & { name: string })[] } {
  const { trip, members, dateOptions, dateVotes, plans, swipes, nudges, now, tripUrl } = args;
  const coordinator = members.find((m) => m.is_coordinator);
  const from = coordinator?.name ?? "Riya";
  const sentKeys = new Set(nudges.map((n) => `${n.member_id}|${n.nudge_kind}`));
  const due: Nudge[] = [];
  const month = fmtMonth(trip.target_month);

  const push = (member: Member, kind: NudgeKind, logKey: string, title: string, message: string, urgent = false) => {
    if (member.is_coordinator) return; // the coordinator is the one sending nudges
    if (sentKeys.has(`${member.id}|${logKey}`)) return;
    due.push({ member, kind, logKey, title, message, waLink: waLink(member.phone, message), urgent });
  };

  // 1. Deadline nudges for anyone who hasn't finished their 4 quick taps.
  const stage = trip.status === "collecting" ? deadlineStage(trip, now) : null;
  if (stage) {
    for (const m of members.filter((x) => !x.submitted_at)) {
      const link = `${tripUrl}/${m.id}`; // straight to their page, no name-picking
      const msg =
        stage === "48h"
          ? `Hey ${m.name}! ✈️ "${trip.name}" is coming together for ${month}. Tap your name, say yes/no to a few dates and swipe some trip ideas. 1 minute: ${link} (closes in 2 days)`
          : stage === "24h"
            ? `${m.name}, 24 hours left for "${trip.name}"! ⏳ A few taps on dates + swipe some ideas: ${link}`
            : `Hey ${m.name}, it's ${from} 🙂 Could you tap in your dates for "${trip.name}" tonight? Only 12 hours left and I don't want us to plan without you. ${link}`;
      // Keyed to the deadline, so moving the deadline restarts the 48h/24h/12h reminders.
      push(m, stage, `${stage}@${trip.deadline.slice(0, 16)}`, stage === "12h" ? `12h left, personal note from ${from}` : `${stage} before deadline`, msg, stage === "12h");
    }
  }

  // 2. "Maybe" follow-ups once the day they said they'd know has arrived.
  const today = istDay(now);
  if (trip.status !== "confirmed") {
    for (const m of members) {
      const dueVotes = dateVotes.filter((v) => v.member_id === m.id && v.vote === "maybe" && v.known_by && v.known_by <= today);
      if (!dueVotes.length) continue;
      const knownBy = dueVotes.map((v) => v.known_by!).sort()[0];
      const ranges = dueVotes
        .map((v) => dateOptions.find((o) => o.id === v.option_id))
        .filter((o): o is DateOption => Boolean(o))
        .map((o) => fmtRange(o.start_date, o.end_date))
        .join(", ");
      const msg = `Hi ${m.name}! You said "maybe" for ${ranges} and that you'd know by ${fmtDay(knownBy)}. Can you update your maybe? 🤞 One tap: ${tripUrl}/${m.id}/start?step=1`;
      push(m, "maybe", `maybe:${knownBy}`, `"Maybe" due since ${fmtDay(knownBy)}`, msg);
    }
  }

  // 3. Votes still missing on the current round.
  if (trip.status === "voting") {
    const current = plans.filter((p) => p.status === "active" && p.round === trip.blend_round);
    for (const m of members) {
      const pending = current.filter((p) => !swipes.some((s) => s.plan_id === p.id && s.member_id === m.id));
      if (!pending.length) continue;
      const what = trip.blend_round ? "the blended plan" : `our top ${pending.length} hot spot${pending.length > 1 ? "s" : ""}`;
      push(m, "vote", `vote:${trip.blend_round}`, `Hasn't swiped ${what}`, `${m.name}! 🗳️ ${what} for "${trip.name}" ${trip.blend_round || pending.length === 1 ? "is" : "are"} waiting for your swipe. Yes or no, 30 seconds: ${tripUrl}/${m.id}/swipe`);
    }
  }

  // 4. Confirmation once agreed.
  if (trip.status === "agreed") {
    for (const m of members.filter((x) => !x.confirmed_at)) {
      push(m, "confirm", `confirm:${trip.agreed_plan_id}`, "Hasn't confirmed yet", `We all agreed on "${trip.name}" 🎉 ${m.name}, tap "I'm confirmed" once your leave is sorted: ${tripUrl}/${m.id}`);
    }
  }

  const order: Record<NudgeKind, number> = { "12h": 0, "24h": 1, "48h": 2, maybe: 3, vote: 4, confirm: 5 };
  due.sort((a, b) => order[a.kind] - order[b.kind]);
  const names = new Map(members.map((m) => [m.id, m.name]));
  const sent = nudges
    .map((n) => ({ ...n, name: names.get(n.member_id) ?? "?" }))
    .sort((a, b) => b.sent_at.localeCompare(a.sent_at));
  return { due, sent };
}

/** Message Riya posts in the group chat when there's something new to swipe or confirm. */
export function groupUpdateMessage(args: {
  tripName: string;
  status: Trip["status"];
  blendRound: number;
  plans: Pick<Plan, "destination" | "start_date" | "end_date" | "cost_per_person">[];
  agreed?: Pick<Plan, "destination" | "start_date" | "end_date"> | null;
  tripUrl: string;
}): string | null {
  const { tripName, status, blendRound, plans, agreed, tripUrl } = args;
  const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
  if ((status === "agreed" || status === "confirmed") && agreed) {
    return `🎉 It's happening! "${tripName}" is ${agreed.destination}, ${fmtRange(agreed.start_date, agreed.end_date)}! Tap your name and hit "I'm confirmed" once your leave is sorted: ${tripUrl}`;
  }
  if (!plans.length || (status !== "voting" && status !== "stuck")) return null;
  if (blendRound > 0) {
    const p = plans[0];
    return `🧪 We were split, so here's ONE plan that mixes everyone's favourite bits: ${p.destination}, ${fmtRange(p.start_date, p.end_date)} (≈ ${inr(p.cost_per_person)}/person). Tap your name and swipe yes or no: ${tripUrl}`;
  }
  const list = plans
    .slice(0, 3)
    .map((p, i) => `${i + 1}. ${p.destination} · ${fmtRange(p.start_date, p.end_date)} · ≈ ${inr(p.cost_per_person)}/person`)
    .join("\n");
  return `🔥 Our top ${Math.min(plans.length, 3)} hot spots for "${tripName}" are in!\n${list}\n\nTap your name and swipe yes/no on each. 30 seconds: ${tripUrl}`;
}

/** Riya can nudge anyone at any time: the message fits where that person is. */
export function personalNudge(args: {
  name: string;
  from: string;
  tripName: string;
  status: Trip["status"];
  submitted: boolean;
  swipesPending: number;
  confirmed: boolean;
  personalUrl: string;
}): string {
  const { name, from, tripName, status, submitted, swipesPending, confirmed, personalUrl } = args;
  if (status === "collecting" && !submitted) return `Hey ${name}! It's ${from} 🙂 Got a minute for "${tripName}"? A few dates, a few swipes, done: ${personalUrl}`;
  if ((status === "voting" || status === "stuck") && swipesPending > 0) return `${name}! 🗳️ Plans for "${tripName}" are waiting on your swipe. Yes or no, 30 seconds: ${personalUrl}/swipe`;
  if (status === "agreed" && !confirmed) return `${name}, we all said yes to "${tripName}" 🎉 Tap "I'm confirmed" once your leave is sorted: ${personalUrl}`;
  return `Hey ${name}! Here's your link for "${tripName}" ✈️ ${personalUrl}`;
}
