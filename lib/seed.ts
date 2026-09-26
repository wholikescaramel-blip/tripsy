// Demo trip with 5 friends, so every stage can be tested without real users.
import "server-only";

import { store } from "./store";
import { sampleIdeas } from "./sample-plans";
import {
  AppError,
  createTrip,
  decide,
  generateInitialPlans,
  load,
  saveBudget,
  saveHardPasses,
  setConfirmed,
  swipeIdea,
  voteDate,
} from "./service";
import { istDay } from "./time";
import type { DateVoteValue, TripBundle } from "./types";

export const DEMO_SLUG = "demo";
export const DEMO_ADMIN_KEY = "demo";

interface DemoAnswers {
  votes: DateVoteValue[]; // one per date option, in date order ("maybe" = knows next week-ish)
  likes: string[]; // idea destinations they swipe right on
  budget: "low" | "mid" | "high";
  city: string;
  passes: string[];
  notes?: string;
}

const PEOPLE: { name: string; phone: string; answers?: DemoAnswers }[] = [
  {
    name: "Riya",
    phone: "+91 98200 11111",
    answers: { votes: ["yes", "yes", "yes", "no", "yes"], likes: ["North Goa", "Alleppey backwaters", "Pondicherry", "Lonavala villa weekend"], budget: "high", city: "Mumbai", passes: ["hostels"] },
  },
  {
    name: "Siddharth",
    phone: "+91 98450 22222",
    answers: { votes: ["yes", "maybe", "yes", "no", "yes"], likes: ["Coorg", "Rishikesh", "Hampi", "North Goa"], budget: "high", city: "Bengaluru", passes: ["cold"] },
  },
  {
    name: "Karan",
    phone: "+91 98220 33333",
    answers: { votes: ["yes", "yes", "no", "yes", "yes"], likes: ["North Goa", "Lonavala villa weekend", "Alleppey backwaters", "Udaipur"], budget: "mid", city: "Pune", passes: ["flights"] },
  },
  {
    name: "Aisha",
    phone: "+91 98110 44444",
    answers: { votes: ["yes", "yes", "yes", "yes", "no"], likes: ["Udaipur", "Pondicherry", "Alleppey backwaters", "Coorg"], budget: "mid", city: "Delhi", passes: ["nightlife", "camping"], notes: "no seafood trail" },
  },
  // Preethi hasn't answered yet — the nudges are for them.
  { name: "Preethi", phone: "+91 98400 55555" },
];

const PREETHI: DemoAnswers = { votes: ["yes", "yes", "yes", "no", "yes"], likes: ["North Goa", "Pondicherry", "Alleppey backwaters", "Hampi"], budget: "mid", city: "Chennai", passes: ["trekking"] };

async function answer(b: TripBundle, memberId: string, a: DemoAnswers, now: Date) {
  for (const [i, o] of b.dateOptions.entries()) {
    await voteDate(DEMO_SLUG, memberId, o.id, a.votes[i] ?? "yes", "few_days", now);
  }
  for (const idea of b.ideas) await swipeIdea(DEMO_SLUG, memberId, idea.id, a.likes.includes(idea.destination));
  await saveBudget(DEMO_SLUG, memberId, a.budget, a.city, now);
  await saveHardPasses(DEMO_SLUG, memberId, a.passes, a.notes ?? "", now);
}

export async function seedDemo() {
  const existing = await store.getBundle(DEMO_SLUG);
  if (existing) await store.deleteTrip(existing.trip.id);

  const now = new Date();
  const today = istDay(now);
  const nextMonth = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 1)).toISOString().slice(0, 7);
  await createTrip({
    slug: DEMO_SLUG,
    adminKey: DEMO_ADMIN_KEY,
    name: "Five Friends, One Trip",
    month: nextMonth,
    deadline: new Date(now.getTime() + 60 * 3_600_000).toISOString(), // 60h away: 48h nudges start after 12h
    isDemo: true,
    people: PEOPLE.map((p) => ({ name: p.name, phone: p.phone })),
    ideas: sampleIdeas(8), // fixed cards so the demo is the same every time
  });
  const b = await load(DEMO_SLUG);
  for (const p of PEOPLE) {
    if (!p.answers) continue;
    await answer(b, b.members.find((m) => m.name === p.name)!.id, p.answers, now);
  }
  return { slug: DEMO_SLUG, adminKey: DEMO_ADMIN_KEY };
}

/** Demo-only shortcuts, so a single tester can play all 5 people. */
export async function demoAction(action: string, now: Date) {
  const b = await load(DEMO_SLUG);
  const byName = (n: string) => {
    const m = b.members.find((x) => x.name === n);
    if (!m) throw new AppError(409, `${n} isn't on the demo trip any more — reset the demo.`);
    return m;
  };

  switch (action) {
    case "fill-preethi":
      await answer(b, byName("Preethi").id, PREETHI, now);
      await generateInitialPlans(DEMO_SLUG, now);
      return "Preethi answered — everyone's in, plans made.";
    case "karan-busy": {
      // Karan can no longer do the first weekend: breaks any plan on those dates.
      const first = b.dateOptions[0];
      await voteDate(DEMO_SLUG, byName("Karan").id, first.id, "no", null, now);
      return "Karan can no longer do the first weekend.";
    }
    case "sid-maybe-yes":
    case "sid-maybe-no": {
      const sid = byName("Siddharth");
      const maybes = b.dateVotes.filter((v) => v.member_id === sid.id && v.vote === "maybe");
      if (!maybes.length) throw new AppError(409, "Siddharth has no open maybe.");
      for (const v of maybes) await voteDate(DEMO_SLUG, sid.id, v.option_id, action === "sid-maybe-yes" ? "yes" : "no", null, now);
      return `Siddharth's maybe turned into a ${action === "sid-maybe-yes" ? "yes" : "no"}.`;
    }
    case "aisha-veto-beach": {
      const aisha = byName("Aisha");
      const prefs = b.preferences.find((p) => p.member_id === aisha.id);
      await saveHardPasses(DEMO_SLUG, aisha.id, [...new Set([...(prefs?.vetoes ?? []), "beaches"])], prefs?.veto_notes ?? "", now);
      return "Aisha added 'Beaches' as a hard pass.";
    }
    case "swipe-split":
    case "swipe-yes": {
      if (!["voting", "stuck"].includes(b.trip.status)) throw new AppError(409, "No plans to swipe on right now.");
      const current = b.plans.filter((p) => p.status === "active" && p.round === b.trip.blend_round);
      for (const [i, p] of current.entries()) {
        for (const [j, m] of b.members.entries()) {
          if (b.swipes.some((s) => s.plan_id === p.id && s.member_id === m.id)) continue;
          // Split: each plan gets 3 yeses (rotating), so nothing is unanimous.
          const accept = action === "swipe-yes" ? true : (j + i) % b.members.length < 3;
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
