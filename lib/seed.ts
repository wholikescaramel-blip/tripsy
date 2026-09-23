// Demo trip with 5 friends, so every stage can be tested without real users.
import "server-only";

import { store } from "./store";
import { AppError, decide, load, saveAnswers, setConfirmed, type AnswersInput } from "./service";
import { addDays, istDay, monthDays } from "./time";
import type { DayStatus } from "./types";

export const DEMO_SLUG = "demo";
export const DEMO_ADMIN_KEY = "demo";

type Pattern = Record<number, DayStatus>; // day-of-month -> status (unlisted = busy)

function range(from: number, to: number, status: DayStatus): Pattern {
  const out: Pattern = {};
  for (let d = from; d <= to; d++) out[d] = status;
  return out;
}

function toAvailability(monthStart: string, pattern: Pattern, knownBy?: string) {
  return monthDays(monthStart)
    .map((day) => ({ day, status: pattern[Number(day.slice(8))] }))
    .filter((a) => a.status)
    .map((a) => ({ ...a, maybe_known_by: a.status === "maybe" ? (knownBy ?? null) : null }));
}

interface DemoPerson {
  name: string;
  phone: string;
  answers?: (month: string, knownBy: string) => AnswersInput;
}

const PEOPLE: DemoPerson[] = [
  {
    name: "Riya",
    phone: "+91 98200 11111",
    answers: (month) => ({
      availability: toAvailability(month, { ...range(6, 19, "free"), ...range(24, 31, "free") }),
      home_city: "Mumbai",
      vibes: ["beach", "chill", "foodie"],
      activities: ["beach_time", "cafes", "food_crawl", "villa"],
      vetoes: ["early_mornings", "hostels"],
      veto_notes: "",
      wishes: "Somewhere we can actually talk, not rush around.",
      budget: { min: 12000, max: 25000 },
    }),
  },
  {
    name: "Siddharth",
    phone: "+91 98450 22222",
    answers: (month, knownBy) => ({
      availability: toAvailability(month, { ...range(6, 11, "free"), ...range(12, 14, "maybe"), ...range(15, 19, "free"), 24: "free", ...range(28, 31, "free") }, knownBy),
      home_city: "Bengaluru",
      vibes: ["adventure", "nature", "beach"],
      activities: ["trekking", "water_sports", "stargazing", "photography"],
      vetoes: ["cold"],
      veto_notes: "",
      wishes: "One proper adventure day please!",
      budget: { min: 15000, max: 30000 },
    }),
  },
  {
    name: "Karan",
    phone: "+91 98220 33333",
    answers: (month) => ({
      availability: toAvailability(month, { ...range(8, 19, "free"), ...range(24, 31, "free") }),
      home_city: "Pune",
      vibes: ["party", "foodie", "chill"],
      activities: ["nightlife", "food_crawl", "villa", "boat"],
      vetoes: ["flights"],
      veto_notes: "",
      wishes: "",
      budget: { min: 8000, max: 15000 },
    }),
  },
  {
    name: "Aisha",
    phone: "+91 98110 44444",
    answers: (month) => ({
      availability: toAvailability(month, { ...range(1, 17, "free"), ...range(24, 31, "free") }),
      home_city: "Delhi",
      vibes: ["culture", "chill", "wellness"],
      activities: ["heritage", "cafes", "spa", "shopping"],
      vetoes: ["nightlife", "camping"],
      veto_notes: "no seafood trail",
      wishes: "Good coffee and one slow morning.",
      budget: { min: 10000, max: 22000 },
    }),
  },
  // Preethi hasn't filled in the form yet — the nudges are for them.
  {
    name: "Preethi",
    phone: "+91 98400 55555",
  },
];

export const PREETHI_ANSWERS = (month: string): AnswersInput => ({
  availability: toAvailability(month, { ...range(1, 27, "free") }),
  home_city: "Chennai",
  vibes: ["beach", "foodie", "culture"],
  activities: ["beach_time", "food_crawl", "photography", "boat"],
  vetoes: ["trekking"],
  veto_notes: "",
  wishes: "",
  budget: { min: 10000, max: 20000 },
});

export async function seedDemo() {
  const existing = await store.getBundle(DEMO_SLUG);
  if (existing) await store.deleteTrip(existing.trip.id);

  const now = new Date();
  const today = istDay(now);
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 10);
  const deadline = new Date(now.getTime() + 60 * 3_600_000).toISOString(); // 60h away: 48h nudges start after 12h
  const knownBy = addDays(today, 2);

  const b = await store.createTrip({
    slug: DEMO_SLUG,
    admin_key: DEMO_ADMIN_KEY,
    name: "Five Friends, One Trip",
    target_month: nextMonth,
    deadline,
    is_demo: true,
    members: PEOPLE.map((p, i) => ({ name: p.name, phone: p.phone, is_coordinator: i === 0 })),
  });
  for (const p of PEOPLE) {
    const m = b.members.find((x) => x.name === p.name)!;
    if (p.answers) await saveAnswers(DEMO_SLUG, m.id, p.answers(nextMonth, knownBy), now);
  }
  return { slug: DEMO_SLUG, adminKey: DEMO_ADMIN_KEY };
}

/** Demo-only shortcuts, so a single tester can play all 5 people. */
export async function demoAction(action: string, now: Date) {
  const b = await load(DEMO_SLUG);
  const byName = (n: string) => b.members.find((m) => m.name === n)!;
  const month = b.trip.target_month;

  switch (action) {
    case "fill-preethi": {
      await saveAnswers(DEMO_SLUG, byName("Preethi").id, PREETHI_ANSWERS(month), now);
      return "Preethi filled in their answers.";
    }
    case "karan-busy": {
      // Karan can suddenly no longer do the 9th–10th: breaks any plan on those dates.
      const karan = byName("Karan");
      const avail = b.availability
        .filter((a) => a.member_id === karan.id)
        .map((a) => (["09", "10"].includes(a.day.slice(8)) ? { ...a, status: "busy" as const } : a));
      const prefs = b.preferences.find((p) => p.member_id === karan.id)!;
      await saveAnswers(DEMO_SLUG, karan.id, { ...prefs, availability: avail, budget: null }, now);
      return "Karan is now busy on the 9th and 10th.";
    }
    case "sid-maybe-yes":
    case "sid-maybe-no": {
      const sid = byName("Siddharth");
      const to = action === "sid-maybe-yes" ? "free" : "busy";
      const avail = b.availability
        .filter((a) => a.member_id === sid.id)
        .map((a) => (a.status === "maybe" ? { ...a, status: to as DayStatus, maybe_known_by: null } : a));
      const prefs = b.preferences.find((p) => p.member_id === sid.id)!;
      await saveAnswers(DEMO_SLUG, sid.id, { ...prefs, availability: avail, budget: null }, now);
      return `Siddharth's maybe turned into a ${to === "free" ? "yes" : "no"}.`;
    }
    case "aisha-veto-beach": {
      const aisha = byName("Aisha");
      const prefs = b.preferences.find((p) => p.member_id === aisha.id)!;
      const avail = b.availability.filter((a) => a.member_id === aisha.id);
      await saveAnswers(DEMO_SLUG, aisha.id, { ...prefs, vetoes: [...new Set([...prefs.vetoes, "beaches"])], availability: avail, budget: null }, now);
      return "Aisha added 'Beaches' as a hard no.";
    }
    case "swipe-split":
    case "swipe-yes": {
      if (!["voting", "stuck"].includes(b.trip.status)) throw new AppError(409, "No voting going on right now.");
      const current = b.plans.filter((p) => p.status === "active" && p.round === b.trip.blend_round);
      const members = b.members;
      for (const [i, p] of current.entries()) {
        for (const [j, m] of members.entries()) {
          if (b.swipes.some((s) => s.plan_id === p.id && s.member_id === m.id)) continue;
          // Split: plan i is liked by 3 people (rotating), so nothing is unanimous.
          const accept = action === "swipe-yes" ? true : (j + i) % members.length < 3;
          await store.upsertSwipe(b.trip.id, {
            plan_id: p.id,
            member_id: m.id,
            decision: accept ? "accept" : "decline",
            reason: accept ? null : ["Not my vibe", "Too far / too much travel", "Too pricey for me"][(i + j) % 3],
          });
        }
      }
      await decide(DEMO_SLUG, now);
      return action === "swipe-yes" ? "Everyone who hadn't swiped said yes." : "Everyone who hadn't swiped voted — split down the middle.";
    }
    case "confirm-others": {
      if (b.trip.status !== "agreed") throw new AppError(409, "Nothing agreed yet.");
      for (const m of b.members.filter((x) => !x.confirmed_at && !x.is_coordinator)) await setConfirmed(DEMO_SLUG, m.id, true);
      return "Everyone except Riya confirmed.";
    }
    default:
      throw new AppError(400, "Unknown demo action");
  }
}
