# Product

What One Score is, who uses it, every screen, the design, and the words.

## Brief


## Problem
Facility programs live in coaches' heads. Athletes get the same session whether they slept 4 hours or 9, played a game yesterday or not. Coaches can't individualize 60+ athletes by hand.

## Solution
The facility answers its Setup questions once, in the app. The app turns it into rules and prescribes each athlete's day automatically, adjusted for readiness, training load, testing, availability, and season phase.

## Users
Roles follow the Vault Standard's Four Roles (see `docs/05-schema-and-access.md`):
- **Architect** — Garrett / STS. Outside the tenant model. Creates, suspends, supports tenants. Helps fill Layer 4 during the install.
- **Owner** — facility owner or head coach. Completes Setup, roster, invites, branding, billing. Sees everything in their tenant.
- **Operator** — coaches and athletic trainers. Run the floor: board, athlete detail, status, overrides. No billing, no settings.
- **Athlete** — checks in, sees score + plan, logs RPE and nutrition. Sees only their own record. Often a minor, on a phone.

## Version 1 — in
- In-app Setup questionnaire with plain-language errors on each question
- Athlete join + check-in + score + daily plan + Save session + nutrition entry
- Coach team board, athlete detail, status/restrictions, override with reason
- Roster: add athletes by form
- Installable PWA on Netlify

## Version 1 — out (later, mostly n8n)
Parent reports, sport coach summaries, owner reports, notifications, bar speed, body-map location tap, multi-facility owner dashboards, payments.

## Success for v1
- A coach with no tech skill goes from a blank Setup to athletes checking in, without Garrett touching the keyboard.
- 80%+ daily check-in rate in the pilot. Check-in under 30 seconds.
- Two facilities with different Setup answers produce different plans for the same check-in (see `docs/06-vault-check-and-tests.md`).


## Coach Experience


This is the acceptance test for "no tech ability." If a step needs more than this, the build is not done.

1. **Gets a link**, creates their account (Owner).
2. **Opens Setup** and answers 16 short sections in order (Scoring & Zones → Coach Override). Each dropdown shows what each answer means. Advanced numbers stay tucked away unless they open them. Progress saves as they go — they can stop and come back.
3. **Taps Finish.** App says **"Rules saved"** or marks each question that needs a fix, in plain language: *"Scoring & Zones: How cautious are you with a tired athlete? — pick an answer."*
4. **Adds athletes** on the roster form.
5. **Invites athletes** — one tap per athlete (or all at once from the roster). Each athlete gets an email invite link, sets an 8+ character password, and lands on today's check-in. For minors the invite can go to a parent's email (see `docs/07-privacy.md`).
6. **Opens the team board** every morning. Red first.

Changing philosophy later = open Setup, change answers, Finish. The app keeps the old version and shows what changed.


## Users & Screens


## Athlete (phone first)
### Accept invite / log in
Invite link (expires) → set password (8+ characters) → linked to their athlete record. After that: email + password, stay signed in on that device.

### Check-in (before today's score exists)
Gray slab reading "Check in", then five 1–5 tap rows (Sleep hours uses the facility's labels from `sleep.tap1–5`, e.g. <6, 6, 7, 8, 9+), Nutrition yesterday (Hit / Missed), and on the facility's `test.weekly.day` an optional test value in `test.weekly.unit`. Button: **Get today's plan** (disabled until all taps answered).

### Today (after check-in) — matches `_reference/index.html`
1. **Score slab:** the number only, huge, on the zone color. No words. (Accessible label: "Green zone, score 82".)
2. **Training:** heading + "Full session / One at a time" toggle. Numbered collapsible blocks in order (Core 4 → Skill/Speed per `skill.order` → Strength → Conditioning, or Practice / Game / Rehab blocks). Collapsed row shows block name + item count. Open shows each item: name, sets × reps (or amount + unit), load. Anchor lift gets an "Anchor" marker. One red status line if Modified/Out (e.g. "Modified: No sprinting").
3. **Session log:** Session RPE taps 1–10, Minutes (blank — athlete types it; no rule sets lift minutes), and on practice/game days a second RPE + minutes (prefilled from `team.practice_min` / `team.game_min`). **Save session** button, disabled until needed RPEs tapped.
4. **Nutrition:** calorie target (big), Protein / Carbs / Fat targets, four number inputs for what they hit.

Off day: "Off day. No training. Hit your nutrition numbers." + nutrition.

## Coach
- **Team board:** every active athlete as a row: zone color chip + score, name, sport, status, flags (Red, Yellow streak, sleep flag, stress flag, soreness flag, missed check-in). Sort Red → Yellow → Green → no check-in. Filter by sport.
- **Athlete detail:** today's plan (read-only, same component as athlete), 28-day readiness + load chart, A:C, test trend, status + restrictions editor, override (zone up/down + one-line reason; "up" requires reason if `override.up_reason` = Reason required), history.
- **Roster:** add/edit athletes (all Athlete Intake fields), deactivate.
- **Setup (Owner only):** answer or change the Setup questions, Finish, see current rules version + diff vs previous.
- **Settings (Owner only):** facility name, branding (display name, logo, accent color), invites (email + role: Operator or Athlete; Operator title: coach / athletic trainer), stress windows (date ranges), practice intensity entry when `team.load_method` = Coach tag (Operators can enter this too), billing.
- **Parent share link (last module):** Owner/Operator creates a link to one athlete's monthly report. Scoped to that record, expires (Share Lock).
Who can do what: see `docs/05-schema-and-access.md`.


## Design

Brand once, after every module exists: one token file (`src/theme/tokens.css`), nothing hard-coded. Owners can re-skin **display name, logo, and accent color only** (`tenant_branding`). The zone colors (green / yellow / red) are meaning, not paint — they never change per tenant.


## Brand (STS)
- Black `#000000`, green `#13BE17`, white. High contrast, minimal, sharp.
- Headers: "ETNA" if installed, fallback Public Sans 800/900. Secondary: Public Sans Medium Italic. Body: Public Sans.
- Circle-S logo: SVG path is inside `_reference/index.html` (`const LOGO`). Reuse it.

## Tokens
```
light: --bg #FFFFFF --ink #000000 --muted #5C5C5C --line #E2E2E2 --panel #F3F3F3 --accent #0B9A0F
dark:  --bg #000000 --ink #FFFFFF --muted #9C9C9C --line #2A2A2A --panel #141414 --accent #13BE17
zones: --z-green #13BE17  --z-yellow #F2C200  --z-red #E5383B  (text on zone slab is always black)
```
Follow the system light/dark setting.

## Rules
- The score slab is the one loud element. Everything else is quiet.
- Tap targets ≥ 44px. Tap rows are 5 (or 10 for RPE) equal buttons.
- Numbers use tabular figures.
- Sentence case. Plain verbs. Buttons say what happens: "Get today's plan", "Save session", "Finish setup".
- Errors say what's wrong and how to fix it. Never "Something went wrong."
- Respect reduced motion. Visible focus rings.


## Glossary

Plain-language meanings. Code names in `backticks`.

| Word | Meaning |
|---|---|
| Rules | Everything a facility answered in Setup, resolved. One JSON object per facility, versioned. `rules` |
| Decision | A Layer 2 dropdown answer in Setup. Each answer sets several rule values. Keys start with `dec.` |
| Advanced number | Optional Layer 4 box (collapsed in Setup). Overrides what a decision set. |
| Program field | Layer 3: exercises, drills, days, dates. Read as-is. |
| Check-in | Morning taps: sleep hours, sleep quality, soreness, stress, energy (1–5 each) + nutrition yesterday (hit/missed). Optional weekly test value. |
| Readiness | Today's check-in turned into 0–100. |
| Score | Readiness blended with the prior 7 days, plus testing adjustment. 0–100. What the athlete sees. |
| Zone | Green / Yellow / Red. What the score means for training. The color behind the number. |
| RPE | Rate of perceived exertion, 1–10, tapped after a session. |
| Tonnage | Σ sets × reps × load for the lifts in a session. |
| Load | Training load for a day. Session: (tonnage ÷ divisor + minutes) × RPE. Practice/game: minutes × RPE. |
| A:C | Acute ÷ chronic load. Short-window average vs long-window average. |
| Build day | Green + under-loaded (A:C below the low line) → extra sets. |
| Anchor lift | The fixed main lift for a lift day (The Anchor Method). |
| Day A / B / C | Lift days in week order. First lift day of the week = A. |
| Training max | Per-athlete, per-anchor number all anchor loads come from. |
| Tag / Region | Label on an exercise (Lower, Upper, Core, Full, Jump, Run, Contact) so restrictions remove the right work. |
| Status | Full / Modified / Out. Set by the athletic trainer or medical provider. Overrides the score. |
| Phase | Off-season / Preseason / In-season / Postseason, from the facility's start dates. |
| Build → Blend → Express | Learn it clean, add variability, execute at game speed. |
