// Offline plan generator used when GEMINI_API_KEY is missing (or Gemini fails).
// It picks from a small catalogue of real Indian trips, drops anything that clashes
// with someone's hard no's, and writes plans in exactly the shape Gemini returns.

import type { PlanContext, VoteSummary } from "./plan-context";
import type { IdeaDraft, PlanDraft } from "./types";
import { vetoHits } from "./rules";
import { addDays, daysBetween } from "./time";

interface Access {
  text: string;
  tags: string[];
  cost: number; // rough round trip per person
}

interface CatalogActivity {
  key: string; // ACTIVITIES option key
  title: string;
  tags?: string[]; // veto keys this activity triggers
}

interface Destination {
  destination: string;
  region: string;
  vibes: string[];
  tags: string[]; // place-level veto keys
  access: Access[];
  perDay: number;
  stay: string;
  stayTags?: string[];
  activities: CatalogActivity[];
}

const CATALOG: Destination[] = [
  {
    destination: "North Goa",
    region: "Goa",
    vibes: ["beach", "party", "chill", "foodie"],
    tags: ["beaches", "touristy"],
    access: [
      { text: "Fly into Mopa/Dabolim (1–2h from most metros), then a cab", tags: ["flights"], cost: 7500 },
      { text: "Overnight Konkan train or sleeper bus, then a cab", tags: ["overnight_travel", "long_travel"], cost: 3000 },
    ],
    perDay: 3200,
    stay: "Private villa with a pool in Assagao",
    activities: [
      { key: "beach_time", title: "Lazy afternoon at Ashwem beach shacks", tags: ["beaches"] },
      { key: "nightlife", title: "Night out at Tito's Lane", tags: ["nightlife"] },
      { key: "food_crawl", title: "Goan thali & bebinca trail in Panjim" },
      { key: "cafes", title: "Cafe hop in Assagao & Anjuna" },
      { key: "water_sports", title: "Jet ski & parasailing at Calangute", tags: ["water_sports"] },
      { key: "villa", title: "Villa night: board games, music, BBQ" },
      { key: "heritage", title: "Fontainhas Latin Quarter wander", tags: ["long_walks"] },
      { key: "boat", title: "Sunset cruise on the Mandovi", tags: ["boats"] },
    ],
  },
  {
    destination: "Gokarna",
    region: "Karnataka coast",
    vibes: ["beach", "chill", "nature", "adventure"],
    tags: ["beaches"],
    access: [
      { text: "Train to Gokarna Road or Karwar, then a short cab", tags: [], cost: 2500 },
      { text: "Fly into Goa, then a 3h drive south", tags: ["flights"], cost: 7000 },
    ],
    perDay: 2200,
    stay: "Cliffside cottages near Om Beach",
    activities: [
      { key: "trekking", title: "Beach-to-beach trek: Kudle → Om → Half Moon", tags: ["trekking", "beaches"] },
      { key: "beach_time", title: "Sunset at Paradise beach", tags: ["beaches"] },
      { key: "cafes", title: "Slow breakfasts at Namaste Cafe" },
      { key: "boat", title: "Dolphin-spotting boat ride", tags: ["boats"] },
      { key: "stargazing", title: "Stargazing on the cliffs" },
      { key: "heritage", title: "Mahabaleshwar temple & old town", tags: ["religious"] },
    ],
  },
  {
    destination: "Pondicherry",
    region: "Tamil Nadu",
    vibes: ["chill", "culture", "foodie", "beach", "city"],
    tags: ["beaches"],
    access: [
      { text: "Fly into Chennai, then a 3h scenic drive on ECR", tags: ["flights"], cost: 6500 },
      { text: "Train or bus to Chennai/Villupuram, then a cab", tags: [], cost: 2500 },
    ],
    perDay: 2800,
    stay: "Heritage guesthouse in White Town",
    stayTags: ["basic_stays"],
    activities: [
      { key: "cafes", title: "French Quarter cafe crawl" },
      { key: "heritage", title: "White Town & Tamil Quarter heritage walk", tags: ["long_walks", "museums"] },
      { key: "food_crawl", title: "Creole seafood & filter coffee trail" },
      { key: "beach_time", title: "Paradise beach day", tags: ["beaches"] },
      { key: "scuba", title: "Try-dive at Temple Reef", tags: ["swimming"] },
      { key: "cycling", title: "Cycle to Auroville & the Matrimandir" },
      { key: "shopping", title: "Handmade paper & pottery shopping" },
    ],
  },
  {
    destination: "Coorg",
    region: "Karnataka",
    vibes: ["nature", "chill", "mountains", "wellness"],
    tags: ["hill_stations", "winding_roads"],
    access: [
      { text: "Overnight bus from Bengaluru/Mumbai, or fly to Mysuru/Mangaluru + 3h winding drive", tags: ["overnight_travel", "winding_roads"], cost: 4500 },
      { text: "Cab from Bengaluru (5–6h, some winding stretches)", tags: ["winding_roads"], cost: 3500 },
    ],
    perDay: 3000,
    stay: "Coffee-estate bungalow with a bonfire deck",
    activities: [
      { key: "photography", title: "Coffee plantation walk & tasting" },
      { key: "trekking", title: "Sunrise hike up Tadiandamol", tags: ["trekking", "early_mornings"] },
      { key: "adventure_sports", title: "River rafting at Barapole", tags: ["adventure_sports", "water_sports"] },
      { key: "villa", title: "Bonfire, pandi curry & music night" },
      { key: "spa", title: "Ayurvedic massage afternoon" },
      { key: "photography", title: "Abbey Falls & Raja's Seat viewpoints" },
    ],
  },
  {
    destination: "Munnar",
    region: "Kerala",
    vibes: ["nature", "mountains", "chill"],
    tags: ["hill_stations", "winding_roads"],
    access: [
      { text: "Fly into Kochi, then a 4h winding hill drive", tags: ["flights", "winding_roads"], cost: 7500 },
      { text: "Train to Ernakulam, then a 4h hill drive", tags: ["winding_roads"], cost: 3500 },
    ],
    perDay: 2800,
    stay: "Tea-estate resort with valley views",
    activities: [
      { key: "photography", title: "Tea museum & plantation walk", tags: ["museums"] },
      { key: "trekking", title: "Kolukkumalai jeep ride & sunrise trek", tags: ["trekking", "early_mornings"] },
      { key: "wildlife", title: "Eravikulam park: spot the Nilgiri tahr", tags: ["wildlife"] },
      { key: "spa", title: "Ayurvedic spa evening" },
      { key: "food_crawl", title: "Kerala sadya lunch" },
      { key: "boat", title: "Pedal boats on Kundala lake", tags: ["boats"] },
    ],
  },
  {
    destination: "Alleppey backwaters",
    region: "Kerala",
    vibes: ["chill", "nature", "foodie", "wellness"],
    tags: [],
    access: [
      { text: "Fly into Kochi, then a 1.5h drive", tags: ["flights"], cost: 7500 },
      { text: "Train to Alappuzha (overnight from most cities)", tags: ["overnight_travel", "long_travel"], cost: 3000 },
    ],
    perDay: 3600,
    stay: "Private houseboat night + lakeside resort",
    stayTags: ["boats"],
    activities: [
      { key: "boat", title: "Overnight houseboat through the backwaters", tags: ["boats"] },
      { key: "food_crawl", title: "Karimeen fry & toddy-shop food (veg options too)" },
      { key: "cycling", title: "Village cycle ride along the canals" },
      { key: "spa", title: "Ayurvedic massage" },
      { key: "beach_time", title: "Sunset at Marari beach", tags: ["beaches"] },
      { key: "photography", title: "Canoe ride through narrow canals at dawn", tags: ["boats", "early_mornings"] },
    ],
  },
  {
    destination: "Udaipur",
    region: "Rajasthan",
    vibes: ["culture", "chill", "foodie", "city"],
    tags: [],
    access: [
      { text: "Fly into Udaipur (direct from most metros)", tags: ["flights"], cost: 8000 },
      { text: "Train to Udaipur City (overnight from Mumbai/Delhi)", tags: ["overnight_travel", "long_travel"], cost: 3000 },
    ],
    perDay: 3200,
    stay: "Lake-view haveli hotel near Lal Ghat",
    activities: [
      { key: "heritage", title: "City Palace & Jagdish temple", tags: ["religious", "museums"] },
      { key: "boat", title: "Sunset boat on Lake Pichola", tags: ["boats"] },
      { key: "cafes", title: "Rooftop cafes at Ambrai Ghat" },
      { key: "food_crawl", title: "Dal baati & kachori crawl" },
      { key: "shopping", title: "Hathi Pol market for block prints", tags: ["shopping"] },
      { key: "photography", title: "Monsoon Palace sunset viewpoint" },
    ],
  },
  {
    destination: "Jaipur",
    region: "Rajasthan",
    vibes: ["culture", "foodie", "city"],
    tags: ["touristy"],
    access: [
      { text: "Fly into Jaipur", tags: ["flights"], cost: 7000 },
      { text: "Train (Shatabdi/Vande Bharat from Delhi, overnight from further)", tags: [], cost: 2500 },
    ],
    perDay: 2800,
    stay: "Boutique haveli in the Pink City",
    activities: [
      { key: "heritage", title: "Amer Fort & stepwell", tags: ["long_walks"] },
      { key: "food_crawl", title: "Pyaaz kachori & lassi crawl at MI Road" },
      { key: "shopping", title: "Johari & Bapu Bazaar shopping", tags: ["shopping"] },
      { key: "museums", title: "Albert Hall & City Palace museums", tags: ["museums"] },
      { key: "nightlife", title: "Rooftop bar evening overlooking Hawa Mahal", tags: ["alcohol_centric"] },
      { key: "photography", title: "Patrika Gate & Nahargarh sunset" },
    ],
  },
  {
    destination: "Rishikesh",
    region: "Uttarakhand",
    vibes: ["adventure", "spiritual", "nature", "wellness"],
    tags: ["hill_stations"],
    access: [
      { text: "Fly into Dehradun, then a 45 min cab", tags: ["flights"], cost: 7500 },
      { text: "Overnight train/Volvo to Haridwar or Rishikesh", tags: ["overnight_travel", "long_travel"], cost: 2500 },
    ],
    perDay: 2200,
    stay: "Riverside boutique stay in Tapovan",
    activities: [
      { key: "adventure_sports", title: "White-water rafting on the Ganga", tags: ["adventure_sports", "water_sports"] },
      { key: "festivals", title: "Evening Ganga aarti at Triveni Ghat", tags: ["religious"] },
      { key: "cafes", title: "Cafe crawl in Tapovan" },
      { key: "spa", title: "Morning yoga class by the river", tags: ["early_mornings"] },
      { key: "adventure_sports", title: "Bungee jump at Mohan Chatti", tags: ["adventure_sports", "heights"] },
      { key: "trekking", title: "Short hike to Neer Garh waterfall", tags: ["trekking"] },
    ],
  },
  {
    destination: "Kasol & Parvati Valley",
    region: "Himachal Pradesh",
    vibes: ["mountains", "adventure", "nature", "chill"],
    tags: ["hill_stations", "winding_roads", "remote", "cold"],
    access: [
      { text: "Overnight Volvo from Delhi to Bhuntar, then cab", tags: ["overnight_travel", "long_travel", "winding_roads"], cost: 4500 },
      { text: "Fly into Bhuntar (Kullu), then 1h cab", tags: ["flights", "winding_roads"], cost: 11000 },
    ],
    perDay: 1800,
    stay: "Riverside cottages with a bonfire",
    activities: [
      { key: "trekking", title: "Kheerganga trek & hot spring", tags: ["trekking"] },
      { key: "camping", title: "Night camping under the stars", tags: ["camping", "tents"] },
      { key: "cafes", title: "Israeli cafes of Kasol" },
      { key: "photography", title: "Chalal & Tosh village walks", tags: ["long_walks"] },
      { key: "stargazing", title: "Stargazing by the Parvati river" },
    ],
  },
  {
    destination: "Hampi",
    region: "Karnataka",
    vibes: ["culture", "adventure", "chill"],
    tags: ["hot"],
    access: [
      { text: "Overnight train to Hosapete, then 20 min cab", tags: ["overnight_travel", "long_travel"], cost: 2500 },
      { text: "Fly into Hubballi/Vidyanagar, then 1–3h cab", tags: ["flights"], cost: 8000 },
    ],
    perDay: 1800,
    stay: "Boulder-view resort across the river",
    activities: [
      { key: "heritage", title: "Vittala temple & stone chariot", tags: ["religious"] },
      { key: "photography", title: "Sunrise from Matanga hill", tags: ["early_mornings", "trekking"] },
      { key: "cycling", title: "Scooter/cycle loop around the ruins", tags: ["two_wheelers"] },
      { key: "boat", title: "Coracle ride on the Tungabhadra", tags: ["boats"] },
      { key: "cafes", title: "Hippie island cafes" },
    ],
  },
  {
    destination: "Havelock Island",
    region: "Andaman",
    vibes: ["beach", "adventure", "chill"],
    tags: ["beaches"],
    access: [
      { text: "Fly into Port Blair, then a 2h ferry", tags: ["flights", "boats"], cost: 16000 },
    ],
    perDay: 4200,
    stay: "Beach cottages near Radhanagar",
    activities: [
      { key: "scuba", title: "Beginner scuba dive", tags: ["swimming", "water_sports"] },
      { key: "beach_time", title: "Sunset at Radhanagar beach", tags: ["beaches"] },
      { key: "boat", title: "Glass-bottom boat to Elephant beach", tags: ["boats"] },
      { key: "photography", title: "Kalapathar beach at golden hour", tags: ["beaches"] },
      { key: "food_crawl", title: "Fresh catch dinners (veg thalis too)" },
    ],
  },
  {
    destination: "Lonavala villa weekend",
    region: "Maharashtra",
    vibes: ["chill", "party", "nature"],
    tags: ["hill_stations"],
    access: [
      { text: "Train or cab from Mumbai/Pune (1.5–2.5h); others fly into Pune", tags: [], cost: 3500 },
    ],
    perDay: 2600,
    stay: "Private pool villa with a lawn",
    activities: [
      { key: "villa", title: "Pool, karaoke & board-game marathon" },
      { key: "photography", title: "Tiger Point & Lion's Point views" },
      { key: "trekking", title: "Rajmachi fort hike", tags: ["trekking"] },
      { key: "food_crawl", title: "Chikki, vada pav & corn by the road" },
      { key: "spa", title: "Lazy spa morning" },
    ],
  },
  {
    destination: "Varanasi",
    region: "Uttar Pradesh",
    vibes: ["spiritual", "culture", "foodie"],
    tags: ["touristy"],
    access: [
      { text: "Fly into Varanasi", tags: ["flights"], cost: 8000 },
      { text: "Overnight train to Varanasi Jn", tags: ["overnight_travel", "long_travel"], cost: 2500 },
    ],
    perDay: 2000,
    stay: "Ghat-side heritage guesthouse",
    stayTags: ["basic_stays"],
    activities: [
      { key: "festivals", title: "Ganga aarti at Dashashwamedh", tags: ["religious"] },
      { key: "boat", title: "Sunrise boat along the ghats", tags: ["boats", "early_mornings"] },
      { key: "food_crawl", title: "Kachori, malaiyyo & lassi crawl" },
      { key: "heritage", title: "Sarnath day trip", tags: ["religious", "museums"] },
      { key: "shopping", title: "Banarasi silk shopping", tags: ["shopping"] },
    ],
  },
  {
    destination: "Jim Corbett",
    region: "Uttarakhand",
    vibes: ["nature", "chill", "adventure"],
    tags: [],
    access: [
      { text: "Train to Ramnagar (from Delhi) or cab 5–6h from Delhi", tags: [], cost: 3500 },
      { text: "Fly into Pantnagar/Delhi, then a cab", tags: ["flights"], cost: 8000 },
    ],
    perDay: 4000,
    stay: "Jungle resort on the Kosi river",
    activities: [
      { key: "wildlife", title: "Jeep safari in Dhikala/Bijrani zone", tags: ["wildlife", "early_mornings"] },
      { key: "villa", title: "Resort pool & bonfire evening" },
      { key: "photography", title: "Garjiya Devi temple & river walk", tags: ["religious"] },
      { key: "spa", title: "Spa afternoon at the resort" },
      { key: "stargazing", title: "Night sky from the riverbank" },
    ],
  },
  {
    destination: "Shillong & Cherrapunji",
    region: "Meghalaya",
    vibes: ["nature", "adventure", "culture"],
    tags: ["hill_stations", "winding_roads"],
    access: [
      { text: "Fly into Guwahati, then a 3h winding drive", tags: ["flights", "winding_roads"], cost: 12000 },
    ],
    perDay: 2600,
    stay: "Pine-view guesthouse in Shillong",
    stayTags: ["basic_stays"],
    activities: [
      { key: "trekking", title: "Double-decker living root bridge trek", tags: ["trekking"] },
      { key: "photography", title: "Seven Sisters & Nohkalikai falls" },
      { key: "boat", title: "Clear-water boating at Dawki", tags: ["boats"] },
      { key: "festivals", title: "Live music night at a Shillong cafe" },
      { key: "cafes", title: "Police Bazaar food & cafes" },
    ],
  },
];

const roundTo = (n: number, step = 500) => Math.round(n / step) * step;

function pickDates(ctx: PlanContext, i: number): { start: string; end: string } | null {
  const windows = [...ctx.windows].sort((a, b) =>
    a.kind === b.kind ? a.start.localeCompare(b.start) : a.kind === "everyone_free" ? -1 : 1,
  );
  if (!windows.length) return null;
  const w = windows[i % windows.length];
  const runLen = daysBetween(w.start, w.end) + 1;
  const len = Math.min(runLen, 3);
  // Spread plans inside long windows so they aren't all the same dates.
  const offset = runLen > len ? Math.min(Math.floor(i / windows.length) * 2, runLen - len) : 0;
  const start = addDays(w.start, offset);
  return { start, end: addDays(start, len - 1) };
}

/** Catalogue activity keys of the destinations someone swiped right on. */
function likedKeys(names: string[]): Set<string> {
  return new Set(CATALOG.filter((c) => names.includes(c.destination)).flatMap((c) => c.activities.map((a) => a.key)));
}

function fitLine(person: PlanContext["people"][number], acts: CatalogActivity[], d: Destination): string {
  if (person.assumed) return `Hasn't answered yet, so this one keeps things easy-going with nothing extreme.`;
  const lower = (t: string) => t[0].toLowerCase() + t.slice(1);
  if (person.likedIdeas.includes(d.destination)) return `You swiped right on ${d.destination}, so here it is, with ${lower(acts[0].title)}.`;
  const keys = likedKeys(person.likedIdeas);
  const match = acts.find((a) => keys.has(a.key));
  if (match) return `${match.title}, right up your alley.`;
  return `Nothing on your hard-pass list, and plenty of downtime to just hang out.`;
}

function build(d: Destination, ctx: PlanContext, dates: { start: string; end: string }, preferKeys: string[] = []): PlanDraft | null {
  const vetoes = new Set(ctx.people.flatMap((p) => p.vetoes));
  const allowed = (tags: string[] = []) => !tags.some((t) => vetoes.has(t));
  if (!allowed(d.tags) || !allowed(d.stayTags)) return null;
  const access = d.access.find((a) => allowed(a.tags));
  if (!access) return null;

  const wanted = new Set([...preferKeys, ...likedKeys(ctx.people.flatMap((p) => p.likedIdeas))]);
  const acts = d.activities
    .filter((a) => allowed(a.tags))
    .sort((a, b) => Number(wanted.has(b.key)) - Number(wanted.has(a.key)));
  const days = daysBetween(dates.start, dates.end) + 1;
  const chosen = acts.slice(0, Math.min(acts.length, days + 2));
  if (chosen.length < 2) return null;

  let perDay = d.perDay;
  let stay = d.stay;
  let cost = access.cost + perDay * days;
  if (ctx.budgetCeiling && cost > ctx.budgetCeiling) {
    perDay = Math.round(d.perDay * 0.65);
    stay = `${d.stay} (budget rooms)`;
    cost = access.cost + perDay * days;
  }

  const homes = [...new Set(ctx.people.map((p) => p.homeCity).filter(Boolean))];
  const plan: PlanDraft = {
    destination: d.destination,
    region: d.region,
    summary: `${days} days in ${d.destination}: ${d.vibes.slice(0, 2).join(" + ")} with something for everyone.`,
    start_date: dates.start,
    end_date: dates.end,
    activities: [
      ...chosen.map((a, i) => ({ title: a.title, day: Math.min(days, Math.floor(i / 2) + 1) })),
      ...acts.filter((a) => !chosen.includes(a)).map((a) => ({ title: a.title, day: 0 })),
    ],
    travel: homes.length ? `From ${homes.join(", ")}: ${access.text}` : access.text,
    stay,
    cost_per_person: roundTo(cost),
    fit_notes: Object.fromEntries(ctx.people.map((p) => [p.name, fitLine(p, chosen, d)])),
    tags: [...new Set([...d.tags, ...(d.stayTags ?? []), ...access.tags, ...chosen.flatMap((a) => a.tags ?? [])])],
  };
  // Belt and braces: never hand back something the code checker would reject for vetoes.
  const clash = ctx.people.some((p) => vetoHits(plan, { vetoes: p.vetoes, veto_notes: p.vetoNotes }).length);
  return clash ? null : plan;
}

function score(d: Destination, ctx: PlanContext): number {
  const likes = ctx.ideaLikes.find((l) => l.destination === d.destination)?.likes ?? 0;
  const keys = likedKeys(ctx.people.flatMap((p) => p.likedIdeas));
  return likes * 4 + d.activities.filter((a) => keys.has(a.key)).length;
}

export function samplePlans(ctx: PlanContext, count: number, avoid: string[] = []): PlanDraft[] {
  const ranked = [...CATALOG]
    .filter((d) => !avoid.includes(d.destination))
    .sort((a, b) => score(b, ctx) - score(a, ctx));
  const out: PlanDraft[] = [];
  for (const d of ranked) {
    const dates = pickDates(ctx, out.length);
    if (!dates) break;
    const plan = build(d, ctx, dates);
    if (plan) out.push(plan);
    if (out.length === count) break;
  }
  return out;
}

export function sampleBlend(ctx: PlanContext, votes: VoteSummary[], avoid: string[] = []): PlanDraft | null {
  // Keep the most-liked plan's destination and dates, then borrow the activity types the other
  // side loved. If that destination can't offer them, look for one that serves both sides.
  const [a, b] = votes;
  const keysOf = (v?: VoteSummary) => {
    const d = CATALOG.find((c) => c.destination === v?.plan.destination);
    return (d?.activities ?? []).filter((x) => v?.plan.activities.some((y) => y.title === x.title)).map((x) => x.key);
  };
  const aKeys = keysOf(a);
  const bKeys = keysOf(b);
  const prefer = [...new Set([...aKeys.slice(0, 3), ...bKeys.slice(0, 3), ...aKeys, ...bKeys])];
  const dates = { start: a.plan.start_date, end: a.plan.end_date };
  const order = [a.plan.destination, b?.plan.destination]
    .map((n) => CATALOG.find((c) => c.destination === n))
    .filter((d): d is Destination => Boolean(d));
  const rest = CATALOG.filter((d) => !order.includes(d))
    .map((d) => ({ d, s: d.activities.filter((x) => prefer.includes(x.key)).length * 3 + score(d, ctx) }))
    .sort((x, y) => y.s - x.s)
    .map((x) => x.d);
  for (const d of [...order, ...rest]) {
    if (avoid.includes(d.destination)) continue;
    const coversB = !b || d.activities.some((x) => bKeys.includes(x.key));
    if (!coversB && d !== rest.at(-1)) continue;
    const plan = build(d, ctx, dates, prefer);
    if (!plan) continue;
    const borrowed = plan.activities.filter((x) => {
      const key = d.activities.find((y) => y.title === x.title)?.key;
      return key && bKeys.includes(key) && !aKeys.includes(key);
    });
    const aFans = a.accepted.join(", ") || "one side";
    const bFans = b?.accepted.join(", ") || "the others";
    plan.summary =
      d.destination === a.plan.destination
        ? `Keeps ${d.destination} (${aFans}'s pick) and adds ${borrowed.length ? borrowed.map((x) => x.title[0].toLowerCase() + x.title.slice(1)).slice(0, 2).join(" and ") : "the slower pace"} that ${bFans} liked about ${b?.plan.destination ?? "the other plan"}.`
        : `Somewhere new that mixes what ${aFans} liked about ${a.plan.destination} with what ${bFans} liked about ${b?.plan.destination ?? "the other plan"}.`;
    return plan;
  }
  return null;
}

function ideaEmoji(d: Destination): string {
  if (d.tags.includes("beaches")) return "🏖️";
  if (d.tags.includes("hill_stations")) return "🏔️";
  if (/backwater|houseboat/i.test(d.stay + d.destination)) return "🛶";
  if (d.vibes.includes("culture")) return "🏰";
  if (d.activities.some((a) => a.key === "wildlife")) return "🐅";
  return "🧭";
}

/** Destination idea cards for the swipe step (used when there's no Gemini key, and for the demo). */
export function sampleIdeas(count = 8): IdeaDraft[] {
  // A spread of trip styles: beach, hills, heritage, backwaters, adventure, city, villa…
  const order = ["North Goa", "Coorg", "Udaipur", "Alleppey backwaters", "Rishikesh", "Pondicherry", "Hampi", "Lonavala villa weekend", "Gokarna", "Jim Corbett"];
  const picked = order.map((n) => CATALOG.find((c) => c.destination === n)!).filter(Boolean);
  return picked.slice(0, Math.max(count, 1)).map((d) => {
    const highlights = d.activities.slice(0, 3);
    return {
      destination: d.destination,
      region: d.region,
      pitch: `${d.vibes.slice(0, 2).join(" + ")}, ${d.stay.toLowerCase()}`,
      highlights: highlights.map((a) => a.title),
      emoji: ideaEmoji(d),
      cost_estimate: roundTo(d.access[0].cost + d.perDay * 3, 1000),
      tags: [...new Set([...d.tags, ...(d.stayTags ?? []), ...highlights.flatMap((a) => a.tags ?? [])])],
    };
  });
}
