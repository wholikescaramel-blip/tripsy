# Tripsy — one trip, five friends, zero chasing

A mobile-first web app that collects everyone's availability and wishes, finds common dates,
generates trip plans with Gemini, runs swipe voting (with blending instead of majority rule)
and locks the trip in two steps — so the coordinator (Riya) doesn't have to chase anyone.

**Stack:** Next.js (App Router) on Vercel Hobby · Supabase free plan · Gemini free tier · WhatsApp `wa.me` links.
No other APIs, no background jobs.

## Run it locally (no keys needed)

```bash
npm install
npm run dev        # http://localhost:3000
```

Without keys the app uses an **in-memory store** (resets on restart) and **sample plans**, so
everything can be tested. Click **"Try the demo with 5 friends"** on the home page: it creates
a trip with Riya, Siddharth, Karan, Aisha and Preethi (Preethi hasn't answered yet), and opens
Riya's dashboard with **demo controls**:

- **Time travel** — jump to 48h / 24h / 11h before the deadline, the day a "maybe" is due, or after the deadline.
- **Play the others** — Preethi submits, everyone else swipes (split or all yes), Siddharth's maybe turns into yes/no,
  Karan becomes busy (breaks plans mid-way), Aisha adds a veto, everyone confirms.
- **Open as** any friend to see their view.

## Add the real keys

1. **Supabase:** create a free project → SQL Editor → paste all of [`supabase/schema.sql`](supabase/schema.sql) → Run (once).
2. Copy `.env.example` to `.env.local` and fill in:
   - `GEMINI_API_KEY` (from Google AI Studio)
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API)
3. Restart `npm run dev`. The demo button now seeds the demo trip into Supabase.
4. Open **`/status`** — it checks the URL, key, tables, budget privacy and Gemini, and says exactly what to fix.

`.env.local` is git-ignored — keys never go to GitHub.

## Deploy to Vercel

1. Import this GitHub repo in Vercel (framework: Next.js, no config needed).
2. Add the environment variables in Vercel → Settings → Environment Variables:
   `NEXT_PUBLIC_SUPABASE_URL` (Project URL, e.g. `https://abcd.supabase.co`), `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (the `sb_publishable_…` key — `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_URL` also work) and `GEMINI_API_KEY`.
3. Deploy (and **Redeploy** after changing any variable). Then open `https://<your-app>/status`.
   **Supabase is required on Vercel** — without it the app refuses to save instead of silently losing data.

## How it works

| Step | Where |
|---|---|
| Riya creates trip with just her name (+ optional group size) → one WhatsApp link + private dashboard link | `/new`, `app/api/trips` |
| Friends open the link and **add themselves** (name + optional WhatsApp number) | `/t/[slug]`, `app/api/t/[slug]/join` |
| Friend fills calendar (free / not free / maybe + "when will you know?"), vibes, activities, hard no's, private budget, home city | `/t/[slug]`, `/t/[slug]/[memberId]/form` |
| Nudges at 48h/24h/12h (12h is a personal note from Riya), "update your maybe" on the day, vote & confirm reminders — worked out on each dashboard load | `lib/nudges.ts` |
| Plans start at the deadline, as soon as the expected group size has joined and answered, or when Riya taps "start planning" | `lib/service.ts` → `readyToPlan()` |
| Group-chat nudge at 48h/24h/12h for people who haven't joined yet | `lib/nudges.ts` |
| Missed the deadline (or joined after planning started) → assumed free all days, no vetoes, **average of the others' budgets**; shown to the group | `lib/dates.ts`, `lib/service.ts` |
| Common 2–4 day windows (plain code); maybe-windows shown separately with who's unsure; best options + who's missing if none | `lib/dates.ts` |
| Gemini makes 3 plans as JSON; code rejects any that break a veto, a budget, or the dates | `lib/gemini.ts`, `lib/rules.ts` |
| Swipe cards (touch drag + buttons) | `/t/[slug]/[memberId]/swipe` |
| All accept → AGREED. Split → Gemini blends the top plans (max 2 rounds). Then Riya sees the closest plan and who's unhappy and why | `lib/service.ts` → `decide()` |
| Mid-way edits → change feed, recheck plans, regenerate **only** the broken ones | `lib/service.ts` → `saveAnswers()`, `reconcile()` |
| CONFIRMED: everyone taps "I'm confirmed (leave sorted)" → frozen | `lib/service.ts` → `setConfirmed()` |

### Privacy & rules

- Budgets live in `member_budgets`, which has row-level security **with no read policy**. The app can only
  write a budget (`set_budget`) or ask yes/no questions (`budget_fits`, `budget_ceiling`). Budget numbers never reach any page.
- Vetoes are checked in code (tags from Gemini + keyword scan) on every plan, blend and replacement. Nothing overrides them.
- Costs are rough estimates only. No live prices, no bookings.

### Gemini model

Default `gemini-3.6-flash` (better at juggling vetoes, dates and budgets in one plan). If it's rate-limited or fails, the app
automatically retries with `gemini-3.5-flash-lite` (higher free-tier limits), and if that fails too it falls back to sample
plans so the app never gets stuck. Override with `GEMINI_MODEL`.

## Project map

```
app/                 pages + API routes
components/          UI (Calendar, AnswerWizard, SwipeDeck, PlanCard, Panels, DemoPanel…)
lib/gemini.ts        ALL Gemini calls (+ sample-plan fallback)
lib/sample-plans.ts  offline catalogue used when there's no key
lib/dates.ts         common-date finder
lib/rules.ts         veto / budget / date checks
lib/nudges.ts        nudge logic + wa.me links
lib/service.ts       save answers, change detection, plan generation, deciding, locking
lib/store/           Supabase store + in-memory store
lib/seed.ts          demo trip + demo actions
supabase/schema.sql  database schema (paste into Supabase SQL editor)
docs/components-map.md  who does what (Riya / friends / app / Gemini / Supabase)
```
