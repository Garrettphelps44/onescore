# CLAUDE.md — One Score

**Standard:** This app is being built through **The Vault Standard** (STS internal build standard). The Draft is `_reference/index.html`. The goal is a Vault: real relational tables, `tenant_id` on every table, auth enforced at the database, many tenants fully isolated.

**What it is:** A facility's coach answers the Setup questions in the app, start to finish (16 sections, generated from `field-map.json`). Their answers become the facility's rules. Every athlete checks in each morning, gets one score, and gets their exact training and nutrition for the day — built from *that tenant's* rules.

**Who's building:** Garrett (Architect) is a strength coach, not a professional developer. Explain in plain language. When a step needs him, tell him exactly what to click or paste.

## Current Status
- **Phase:** V — Verify (in progress)
- **Last session:** 2026-09-28 — Kickoff done (inventory in `docs/00-kickoff-inventory.md`, 9 decisions in `VAULT-PLAN.md`). V scaffold built: React + Vite + TS, Vitest, supabase-js, `.env.example`, git → github.com/Garrettphelps44/onescore. Test, build, lint pass; app opens with zero console errors. `field-map.json` uses `ath.birth_year`. Setup moved from PDFs into the app (see Decisions Log); `pdfjs-dist` removed.
- **Next:** Garrett creates Supabase project `one-score-dev` and fills `.env.local`. Then Seal V and start A.
- **Broken / deferred:** —

_Update this block with the Seal Prompt at the end of every session._

## Read order every session
1. This file
2. `VAULT-PLAN.md` — phases, checkboxes, prompts, decisions log
3. `FEATURE-IDEAS.md` if it exists
4. Only the `docs/` file(s) the current phase or module names

## The Five Locks — non-negotiable
- **Tenant Lock** — every table carries `tenant_id`. No exceptions.
- **Access Lock** — control lives in Row Level Security, never in the UI. Hiding a button is not security.
- **Secret Lock** — keys live server-side (Edge Functions). Anything in browser code is public, permanently.
- **Isolation Lock** — two tenants, cross-read attempt, confirm empty — every time the schema changes.
- **Share Lock** — every external link is scoped to one record and expires.

## One Score rules on top of the Locks
- **Nothing hard-coded.** Every number, exercise, threshold, and choice comes from the tenant's rules (from Setup) (`docs/02-rules-contract.md`). If a value isn't in the rules, stop and ask. Never invent a default. The Draft's numbers are examples only.
- **Port the logic, not the code.** From the Draft, the proven pieces are: the scoring flow, the plan flow, the load formula, the athlete screen layout, and the CSS tokens. Every constant in them becomes a rule lookup.
- **Engine = pure functions with tests.** `src/engine/` takes `(rules, athlete, history, date)` and returns data. No database, no UI inside it.
- **Athlete screen matches the Draft.** Number-only score slab on the zone color, collapsible training blocks, Save session, simple nutrition entry. Don't add athlete features.
- **Check-in stays under 30 seconds.** Never add an athlete input no Setup answer uses.
- **Minors' data is protected.** See `docs/07-privacy.md`.
- **One phase at a time. One module per session.** List what you'll touch and stop before changing anything. Open what's already built and confirm it still runs before you commit.

## Stack
React + Vite + TypeScript · Supabase (Postgres, Auth, RLS, Edge Functions) · Vitest · Netlify · PWA (Add to Home Screen) · Stripe in the T phase (secret key server-side only).
Two Supabase projects: `one-score-dev` and `one-score-prod`. Build on dev only.

## Folder map
```
CLAUDE.md             ← this file (Current Status lives here)
VAULT-PLAN.md         ← V-A-U-L-T phases, prompts, checkboxes, decisions
FEATURE-IDEAS.md      ← parking lot. Nothing here gets built mid-phase.
docs/
  00-kickoff-inventory.md  modules, Draft port/rebuild verdicts, schema additions
  01-product.md         users, coach experience, every screen, design, glossary
  02-rules-contract.md  how Setup answers become a tenant's rules
  03-scoring-engine.md  check-in → score → zone
  04-plan-engine.md     zone + rules → today's training and nutrition
  05-schema-and-access.md  Vault schema, domain tables, Four Roles, RLS
  06-vault-check-and-tests.md  the Vault Check + every test case
  07-privacy.md         minors' data
_reference/           ← the Draft and its inputs. Read, never edit, never copy UI code.
  index.html            the Draft (working prototype)
  field-map.json        every Setup question + every decision and what it sets (question source)
  reference-importer.py resolve logic in 30 lines
  sheets/               the original PDFs — wording reference only, the app never reads them
src/                  ← the Vault (you create this)
```
