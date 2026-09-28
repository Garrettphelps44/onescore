# VAULT PLAN — One Score

The Draft (`_reference/index.html`) → a Vault, through **V · A · U · L · T**. In order. No skipping ahead — a Vault built out of order is a Draft with extra steps.

**Total:** ~40–70 hours. At 5–6 protected hours a week, roughly 8–12 weeks. Layer runs long on this one: the rules import and the engine are the product.

**How every session runs:** Reopen Prompt → one Phase or Module Prompt → approve the list → build → Seal Prompt. Prompts are at the bottom.

---

## Status
- [ ] **V** — Verify
- [ ] **A** — Architect
- [ ] **U** — Unlock
- [ ] **L** — Layer
  - [ ] L1 Rules Import
  - [ ] L2 Roster & Intake
  - [ ] L3 Engine
  - [ ] L4 Athlete Today
  - [ ] L5 Availability
  - [ ] L6 Coach Board & Athlete Detail
  - [ ] L7 Settings
  - [ ] L8 Reporting & Share Links
  - [ ] Brand once
  - [ ] Second tenant leak hunt
  - [ ] Owner re-skin
- [ ] **T** — Transact
- [ ] **Vault Check** passed (`docs/06-vault-check-and-tests.md`)

---

## The Three Leaks in this Draft
- **Blob Leak** — the Draft keeps settings and 35 days of history in one localStorage JSON blob (`sts-one-score-v1`).
- **Auth Leak** — the Draft has no login. "Today" and "Coach" are a tab toggle. Anyone who opens it is the coach.
- **File Leak** — one HTML file: CSS, engine, seed data, UI, and events in one script block.

---

## V — Verify (4–6 hrs)
**Goal:** Clean the Draft's scope, save its data as a test case, stand up a clean scaffold.

1. **Cut from the Draft (don't port):** demo controls (Next day, Redo, Reset demo), the seeded random history, the Coach tab's settings form (settings now come from imported sheets), every hard-coded sport, exercise, and number.
2. **Keep (proven logic to port):** scoring flow, plan flow, load formula, the athlete screen layout and interactions, CSS tokens, logo SVG.
3. ~~Export the Draft's data~~ — **cut (2026-09-28).** Draft data is not migrated. The Draft stays in `_reference/` only to show how the prototype works.
4. **New folder, new Supabase project** (`one-score-dev`). Never point the build at a live database.
5. Scaffold React + Vite + TypeScript, Vitest, `pdfjs-dist`, `.env.example`, git, GitHub repo.

**Done when:** the new app opens clean with zero console errors.

## A — Architect (4–6 hrs)
**Goal:** The real schema and the real security. This is the actual rebuild. Spec: `docs/05-schema-and-access.md`.

1. Vault base tables: `tenants`, `tenant_members`, `tenant_branding`, `invites`, `audit_log`, `share_tokens`.
2. One Score domain tables, every one with `tenant_id`.
3. One RLS policy set per table.
4. **Isolation test before any screen exists:** two dummy tenants, cross-read attempts from each, confirm empty.
5. ~~Migrate the Draft's data~~ — **cut (2026-09-28).** No Draft data is carried over.

**Done when:** isolation test passes.

## U — Unlock (2–3 hrs)
**Goal:** Real auth, no fallback.

1. Supabase email + password auth. 8-character minimum. Real email addresses.
2. **Signup creates a tenant, not just a user.** First user in is the Owner.
3. Invites: Owner invites Operators and Athletes by email → `invites` row with token + `expires_at` → accept link → account linked to the tenant with that role (and, for Athletes, to their `athletes` row).
4. Architect access lives outside the tenant model (`architects` table checked in RLS).
5. Roles enforced in RLS. Test: Athlete tries an Operator route and a direct Operator query → blocked.

**Done when:** Owner signup, Operator invite, and Athlete invite all work end to end, and the role test passes.

## L — Layer (21–38 hrs, likely the top of that range)
Dependency order, not click-through order. Record of truth first, reporting last. **One module per session.** Open what's already built and confirm it still runs before you commit.

| # | Module | Read | Port as-is from the Draft | Rebuild / add |
|---|---|---|---|---|
| L1 | **Rules Import** (record of truth) | `02-rules-contract.md`, `field-map.json`, `reference-importer.py` | nothing (new) | PDF upload → resolve → validate → `rules_versions`; plain-language errors; version diff |
| L2 | **Roster & Intake** | `01-product.md` (Roster), `05-schema-and-access.md` | nothing | Add/edit/deactivate athletes; Athlete Intake PDF import; invite from roster; parent consent fields |
| L3 | **Engine** | `03-scoring-engine.md`, `04-plan-engine.md`, `06-vault-check-and-tests.md` | `readiness`, `scoreFor`, `acwr`, `jumpMod`, `plan`, `tonnage`, `nutrTargets` — structure only | Every constant → rule lookup. Phases, restrictions, build rules, flags. Pure TS + Vitest, all test cases incl. Two Coaches |
| L4 | **Athlete Today** | `01-product.md` (Athlete) | Check-in taps, number-only score slab, collapsible blocks + Full session toggle, Save session, nutrition entry | Writes `checkins`, `daily_results` snapshot, `sessions` (load via engine), `nutrition_logs`. PWA install |
| L5 | **Availability** | `04-plan-engine.md` §2, §9 | Status line on athlete screen | Status + restrictions editor, `status_log`, `audit_log`, return-to-train |
| L6 | **Coach Board & Athlete Detail** | `01-product.md` (Coach), `03-scoring-engine.md` §7 | Coach stats, 28-day chart | Team board (Red first, flags), athlete detail, overrides with reason per `override.*` |
| L7 | **Settings** | `01-product.md` (Settings) | nothing | Invites UI, stress windows, practice intensity entry, Operator titles |
| L8 | **Reporting & Share Links** | `05-schema-and-access.md` (Share Lock) | nothing | Parent report share link: one athlete record, expires. Owner audit view |

Then, in this order:
- **Brand once** — one token file `src/theme/tokens.css` from the Draft's tokens. Search the codebase: no hex colors or fonts outside it.
- **Second tenant leak hunt** — create Tenant B **through the real signup flow** (not inserted by hand). Import a different set of sheets. Walk every screen as Owner, Operator, and Athlete of B. Any trace of A = bug.
- **Owner re-skin** — `tenant_branding`: display name, logo, accent color only. Zone colors never change. Same features for everyone. White-label is paint, not a fork.

**Done when:** every module passes its tests, the leak hunt finds nothing, and re-skin works.

## T — Transact (7–13 hrs)
1. Stripe secret key in a Supabase Edge Function. Nowhere else.
2. Stripe webhook (Edge Function) flips `tenants.subscription_status`.
3. Access gated on `subscription_status` in RLS — not by hiding a button. Architect can comp a tenant.
4. **Run your own real data through a full cycle first** — an IRCS or STS test tenant: import sheets, invite athletes, 7+ days of check-ins, sessions, overrides, a share link, a billing cycle.
5. Deploy: Netlify from GitHub → `one-score-prod`. Environment variables set in two places (Netlify + Supabase) — confirm they match.
6. Run the full **Vault Check**.
7. Keep the Draft live two weeks after cutover.

**Done when:** a paying tenant can go from signup to athletes checking in with no help, and the Vault Check passes.

## After launch
Pilot (one facility, 10 athletes, 2 weeks, 80%+ check-in rate, under 30-second check-in) → n8n automations. See `FEATURE-IDEAS.md`.

---

## The Vault Prompts (filled in for One Score)

### Kickoff Prompt
> I'm running One Score through the VAULT Standard. Reference is _reference/index.html — read it in full, but nothing gets copied out except the scoring flow, the plan flow, the load formula, the athlete screen layout, and the CSS tokens. Every constant in that logic becomes a lookup in the tenant's imported rules (read docs/02-rules-contract.md and _reference/field-map.json). Target: React + Vite + Supabase, real relational tables, RLS, multi-tenant from day one, payments later. Don't write code yet — give me the feature inventory by module, what's worth porting versus rebuilding, and a proposed schema with tenant_id on every table, checked against docs/05-schema-and-access.md. Then stop.

### Phase Prompt
> Phase [V/A/U/L/T] only. Do not start the next phase. Read CLAUDE.md and VAULT-PLAN.md first for current status. [the specific work from this plan]. List what you'll touch and stop before making changes.

### Module Prompt
> Layer phase, [L# module] only. Read the [module] section of _reference/index.html — that section only — and the docs named for this module in VAULT-PLAN.md. Port as-is: [the "Port as-is" column]. Rebuild against the new schema, scoped to tenant_id. No localStorage. No hard-coded values — every number comes from the tenant's rules. Additions not in the Draft: [the "Rebuild / add" column]. List every behavior and connection to other modules. Don't copy UI code. Stop and wait — I'll cut before you build.

### Seal Prompt (before clearing context)
> We're wrapping up. Update VAULT-PLAN.md — mark this phase or module complete, note what actually changed versus the plan and why, note any schema change and whether isolation was re-tested. Update CLAUDE.md's Current Status. Commit everything with a clear message. Confirm it landed, then give me a two-line summary. Then stop.

### Reopen Prompt (after a clear)
> Read CLAUDE.md, VAULT-PLAN.md, and FEATURE-IDEAS.md if it exists. Tell me plainly what's done, what's next, and anything flagged broken or deferred. Don't write code yet.

### Something Broke
> Stop. Explain in plain language what's broken and why. Don't change code yet. Give me the smallest fix and wait for my OK.

---

## Decisions Log
_Newest on top. Date — decision — why._

- **2026-09-28 — Kickoff answers** (full inventory + proposed schema in `docs/00-kickoff-inventory.md`):
  1. **Lift-day minutes stay open.** No rule sets them, so the athlete types minutes on lift days. Practice/game minutes prefill from `team.practice_min` / `team.game_min`.
  2. **Multi-sport = `ath.sport`.** Phases are facility-wide, so "In-season sport wins" can't be computed. The athlete's `ath.sport` is treated as the in-season sport until sport-specific phases exist.
  3. **Test box always shows** on `test.weekly.day`, whatever the zone (the zone isn't known until after check-in anyway). `test.yellow` / `test.red` are imported but not used by the engine in v1.
  4. **Same-day changes rebuild today.** A status change or override after check-in rebuilds today's `daily_results` (logged in `audit_log`). Past days never change.
  5. **Consent on the roster + birth year.** Owner/Operator records parent consent on the roster screen. `birth_year` replaces `age` (age goes stale). Needs the intake PDF updated.
  6. **Re-import can't orphan athletes.** If a new import drops a sport an active athlete is on, the import fails and names those athletes.
  7. **PDFs aren't stored.** Coaches still fill every sheet — the sheets are the program. The app reads the values, saves them to `rules_versions.raw`, and discards the file.
  8. **Draft data not migrated.** The Draft is reference only. V step 3 and A step 5 cut.
  9. **Sleep tap 1 = 5.9 hours.** When comparing sleep taps to hours, tap 1 ("under `sleep.tap1`") counts as `sleep.tap1 − 0.1`; taps 2–5 count as their value.

- **2026-09-28 — Built through The Vault Standard.** Five Locks, Four Roles, Vault schema, Vault Check before any customer touches it.
- **2026-09-28 — Rules come only from the sheets.** The app ships blank. The Draft's numbers are examples. Defaults would quietly replace the facility's philosophy.
- **2026-09-28 — Four-layer sheets.** Philosophy (not imported) → Decisions (required, set numbers) → Program → Advanced (optional overrides, Architect territory during the install).
- **2026-09-28 — Athletes use real auth per the Standard.** Email + 8-character password via invite. For minors the invite may go to a parent's email. (Open question in FEATURE-IDEAS: whether a PIN option is ever worth a documented exception.)
- **2026-09-28 — Operator titles.** Coach and athletic trainer are both Operators; `title` handles `override.who` and clearance records. Permission still comes from role + RLS.

## Changes vs plan
_Seal Prompt fills this in._
