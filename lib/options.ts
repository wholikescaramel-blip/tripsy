// Fixed choice lists used by the friend form, Gemini prompts and the veto checker.

export interface Option {
  key: string;
  label: string;
  emoji: string;
}

export interface VetoOption extends Option {
  group: string;
  /** Word-starts that, if found in a plan's destination/activities/travel/stay text, break the veto. */
  keywords: string[];
}

export const VETO_GROUPS = ["Getting there", "Activities", "Places & weather", "Stay", "Food & drink", "Pace & other"];

export const VETOES: VetoOption[] = [
  // Getting there
  { group: "Getting there", key: "flights", label: "Flying", emoji: "✈️", keywords: ["flight", "fly", "flying", "airport", "airline"] },
  { group: "Getting there", key: "overnight_travel", label: "Overnight bus / train", emoji: "🌙", keywords: ["overnight bus", "overnight train", "sleeper bus", "sleeper train", "night bus", "night train", "overnight journey"] },
  { group: "Getting there", key: "long_travel", label: "8h+ journeys", emoji: "⏳", keywords: ["9h", "10h", "11h", "12h", "14h", "16h", "18h", "20h", "24h", "10 hour", "12 hour"] },
  { group: "Getting there", key: "self_drive", label: "Long drives / road trip", emoji: "🚗", keywords: ["road trip", "self-drive", "self drive", "long drive"] },
  { group: "Getting there", key: "winding_roads", label: "Winding ghat roads", emoji: "🌀", keywords: ["winding", "hairpin", "ghat road", "serpentine"] },
  { group: "Getting there", key: "boats", label: "Boats / ferries", emoji: "⛴️", keywords: ["ferry", "boat", "cruise", "houseboat", "kayak", "shikara"] },
  { group: "Getting there", key: "two_wheelers", label: "Bikes / scooters", emoji: "🛵", keywords: ["scooter", "bike ride", "motorbike", "bullet", "two-wheeler", "moped"] },
  { group: "Getting there", key: "international", label: "Leaving India / passport", emoji: "🛂", keywords: ["passport", "visa", "international", "abroad"] },
  // Activities
  { group: "Activities", key: "trekking", label: "Trekking / long hikes", emoji: "🥾", keywords: ["trek", "hike", "hiking", "summit"] },
  { group: "Activities", key: "camping", label: "Camping", emoji: "⛺", keywords: ["camping", "campsite", "tent"] },
  { group: "Activities", key: "water_sports", label: "Water sports", emoji: "🏄", keywords: ["jet ski", "jetski", "parasail", "banana boat", "surf", "water sport", "kayak", "rafting"] },
  { group: "Activities", key: "swimming", label: "Swimming / getting in water", emoji: "🏊", keywords: ["swim", "snorkel", "scuba", "diving"] },
  { group: "Activities", key: "adventure_sports", label: "Adrenaline sports", emoji: "🪂", keywords: ["paraglid", "bungee", "zipline", "zip line", "skydiv", "rafting", "rappel", "canyon swing"] },
  { group: "Activities", key: "heights", label: "Heights / cliff edges", emoji: "🧗", keywords: ["cliff", "cable car", "ropeway", "gondola", "glass bridge", "bungee", "paraglid", "skywalk"] },
  { group: "Activities", key: "wildlife", label: "Wildlife / jungle safari", emoji: "🐅", keywords: ["safari", "jungle", "tiger reserve", "national park", "wildlife"] },
  { group: "Activities", key: "early_mornings", label: "Early wake-ups", emoji: "⏰", keywords: ["sunrise", "5 am", "5am", "4 am", "4am", "early morning", "dawn"] },
  { group: "Activities", key: "nightlife", label: "Clubbing / late nights", emoji: "🪩", keywords: ["clubbing", "nightclub", "nightlife", "pub crawl", "late-night party", "rave"] },
  { group: "Activities", key: "religious", label: "Religious / pilgrimage sites", emoji: "🛕", keywords: ["temple", "pilgrim", "church", "mosque", "gurudwara", "aarti", "monastery", "dargah"] },
  { group: "Activities", key: "shopping", label: "Shopping-heavy days", emoji: "🛍️", keywords: ["shopping", "mall", "market day"] },
  { group: "Activities", key: "museums", label: "Museums & long tours", emoji: "🖼️", keywords: ["museum", "guided tour", "heritage walk", "gallery"] },
  // Places & weather
  { group: "Places & weather", key: "cold", label: "Cold / snow", emoji: "❄️", keywords: ["snow", "freezing", "glacier", "skiing"] },
  { group: "Places & weather", key: "hot", label: "Very hot places", emoji: "🔥", keywords: ["desert", "sand dune", "scorching", "thar"] },
  { group: "Places & weather", key: "high_altitude", label: "High altitude", emoji: "🏔️", keywords: ["ladakh", "leh", "spiti", "high altitude", "high-altitude", "mountain pass", "tawang"] },
  { group: "Places & weather", key: "beaches", label: "Beaches", emoji: "🏖️", keywords: ["beach", "coast", "seaside", "island", "shack"] },
  { group: "Places & weather", key: "hill_stations", label: "Hill stations", emoji: "⛰️", keywords: ["hill station"] },
  { group: "Places & weather", key: "big_cities", label: "Big crowded cities", emoji: "🏙️", keywords: ["mumbai", "delhi", "bangalore", "bengaluru", "kolkata", "chennai", "metro city", "big city"] },
  { group: "Places & weather", key: "remote", label: "Remote / no network", emoji: "📵", keywords: ["remote", "no network", "offbeat", "off-grid", "off grid"] },
  { group: "Places & weather", key: "touristy", label: "Crowded tourist traps", emoji: "📸", keywords: ["tourist hotspot", "crowded", "tourist trap"] },
  // Stay
  { group: "Stay", key: "hostels", label: "Hostels / dorms", emoji: "🛏️", keywords: ["hostel", "dorm", "zostel"] },
  { group: "Stay", key: "shared_rooms", label: "Sharing a room", emoji: "👥", keywords: ["shared room", "sharing room", "twin share", "room share"] },
  { group: "Stay", key: "tents", label: "Tents / glamping", emoji: "🏕️", keywords: ["tent", "glamping", "campsite"] },
  { group: "Stay", key: "basic_stays", label: "Basic stays / no AC", emoji: "🪵", keywords: ["basic stay", "no ac", "homestay", "guesthouse", "dharamshala"] },
  // Food & drink
  { group: "Food & drink", key: "non_veg_heavy", label: "Places hard for vegetarians", emoji: "🥗", keywords: ["seafood trail", "meat-heavy", "non-veg only", "seafood-only"] },
  { group: "Food & drink", key: "alcohol_centric", label: "Alcohol-centric plans", emoji: "🍺", keywords: ["brewery", "winery", "wine tasting", "pub crawl", "bar hopping", "feni", "distillery"] },
  { group: "Food & drink", key: "spicy_food", label: "Very spicy food trails", emoji: "🌶️", keywords: ["spicy food trail", "chilli", "spice challenge"] },
  // Pace & other
  { group: "Pace & other", key: "packed_schedule", label: "Packed, rushed itinerary", emoji: "🏃", keywords: ["packed itinerary", "whirlwind", "back-to-back"] },
  { group: "Pace & other", key: "long_walks", label: "Lots of walking", emoji: "🚶", keywords: ["walking tour", "long walk", "heritage walk", "hundreds of steps"] },
  { group: "Pace & other", key: "animals", label: "Animal rides / close contact", emoji: "🐘", keywords: ["camel ride", "elephant", "horse ride", "pony", "yak"] },
  { group: "Pace & other", key: "photoshoots", label: "Endless photo stops", emoji: "🤳", keywords: ["photoshoot", "instagram spot"] },
];

export const VETO_BY_KEY = Object.fromEntries(VETOES.map((v) => [v.key, v]));

/** The short list of hard passes people tap. The full VETOES list above is what the checker and Gemini use. */
export const HARD_PASS_KEYS = [
  "flights",
  "overnight_travel",
  "trekking",
  "adventure_sports",
  "beaches",
  "cold",
  "nightlife",
  "camping",
  "hostels",
  "boats",
  "religious",
  "self_drive",
];

/** Match typed hard passes ("no treks, hate flying") to known keys, so the checker catches them too. */
export function matchHardPasses(text: string): string[] {
  const t = ` ${text.toLowerCase()} `;
  const esc = (w: string) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hits = new Set<string>();
  for (const v of VETOES) {
    const words = [v.label.toLowerCase(), ...v.keywords];
    if (words.some((w) => new RegExp(`(^|[^a-z])${esc(w)}`).test(t))) hits.add(v.key);
  }
  return [...hits];
}

export const BUDGET_TIERS = [
  { key: "low", emoji: "💸", label: "Keep it cheap", range: "under ₹10k", min: 0, max: 10000 },
  { key: "mid", emoji: "🙂", label: "Comfortable", range: "₹10k – ₹20k", min: 10000, max: 20000 },
  { key: "high", emoji: "🥂", label: "Treat ourselves", range: "₹20k – ₹40k", min: 20000, max: 40000 },
] as const;

export const CITIES = ["Mumbai", "Delhi", "Bengaluru", "Pune", "Chennai", "Hyderabad", "Kolkata", "Ahmedabad"];

/** "When will you know?" chips for a maybe vote → days from today. */
export const KNOW_BY = [
  { key: "few_days", label: "In a few days", days: 3 },
  { key: "next_week", label: "Next week", days: 7 },
  { key: "closer", label: "Closer to the time", days: 14 },
] as const;

export const DECLINE_REASONS = [
  "Dates don't work",
  "Too pricey for me",
  "Not my vibe",
  "Too far / too much travel",
  "Been there already",
];
