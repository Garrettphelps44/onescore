# Rules Contract

Back to `CLAUDE.md` · Used by: `docs/03-scoring-engine.md`, `docs/04-plan-engine.md` · Stored in: `docs/05-schema-and-access.md`

The Setup questions are the program. The coach answers them in the app (the **Setup** screen, module L1). This note defines how those answers become one `rules` object.

## Source files
- `_reference/field-map.json` — **the contract and the question source.** Every question key, label, type, options (with each option's `meaning`), required flag, layer, section (`sheet`), and every decision with what each answer sets. The Setup screen is generated from this file — no question is hand-written in `src/`.
- `_reference/sheets/` — the original PDFs. Reference only: they show the wording and order of each section. The app never reads them.
- `_reference/reference-importer.py` — the resolve logic in Python. Port the resolve/validate part to TypeScript (`src/import/`); ignore its PDF reading.

## Answer key = rule key
Every Setup answer is stored under its rule key, e.g. `score.green_min`, `str.a.anchor`, `dec.score.caution`. Sections follow the `sheet` value (01 Scoring & Zones … 16 Coach Override). Athlete fields (`ath.*`, section 17) are not part of Setup — they're the roster form (module L2).

## Layers
| Layer | Keys | Setup behavior |
|---|---|---|
| 2 Decision | `dec.*` | Required. Dropdown of option labels with each `meaning` shown. Look up the option in `field-map.json → decisions`; copy its `sets` into rules. |
| 3 Program | everything else not advanced | Read as-is. Required if `required: true`. |
| 4 Advanced | `layer: "advanced"` | Optional, collapsed by default. If filled, overrides what the decision set. |

Layer 1 philosophy questions from the PDFs are not in the app.

## Saving and finishing
- Answers save as the coach goes to `rules_drafts` (one per tenant). They can leave and come back.
- **Finish** runs resolve + validate on the draft. Pass → new `rules_versions` row. Fail → each problem shows on its own question, nothing saved.
- Changing rules later = open Setup (it loads the latest answers), change them, Finish again.

## Resolve order
1. Apply every decision's `sets`.
2. Apply program fields.
3. Apply filled advanced fields (override).
4. If a decision option has empty `sets` (Strength → Custom), its advanced fields become required.

## Value types
- `number` → number input. Not a number → "`<label>`: 'abc' is not a number".
- `choice` / `decision` → one of the listed options. Nothing picked = empty.
- `check` → checkbox, true / false.
- `text` → trimmed string.

## Validation (block Finish, show every problem on its question in plain language)
- Any required field empty → "`<Section title>`: `<question or label>` is empty."
- Score weights (if any advanced weight is filled) must all be filled and total 100.
- `score.yellow_min` < `score.green_min`.
- Sport 1 on Sport Skill filled; every sport with a name has 3 drills.
- `team.practice_letter` required when `team.practice_strength` = Reduced or `cond.practice` ≠ None.
- Anchor for Day A required. Day B / C required if the week template for any phase has 2 / 3 Lift days.
- Every phase has a start date (MM/DD) and all 7 week days.
- `profile.new_years` < `profile.adv_years`.
- Roster form: `ath.sport` must match a sport name on Sport Skill (case-insensitive).
- Re-finish: every sport an active athlete is on must still exist on Sport Skill. If not, block Finish and name those athletes.

## Versioning
Rules belong to one tenant. Each successful Finish creates a new `rules_versions` row with that `tenant_id`. The app always uses the latest. Plans already generated keep the version they were built with (`daily_results.rules_version`). The Setup screen shows a diff after Finish: "Green starts at: 75 → 80".

The answers exactly as submitted are saved on the version (`rules_versions.answers`) so a version can be audited or re-resolved.

## Never
- Never fill a missing rule with a default. The prototype's numbers are examples only.
- Never hard-code a sport, exercise, or threshold in `src/`.

## Role mapping for `override.who`
Setup speaks coach language. The app enforces it with the Four Roles and the Operator `title`:
| Setup answer | Who can override (enforced in RLS) |
|---|---|
| Head coach only | Owner |
| Head coach + athletic trainer | Owner + Operators with title = athletic trainer |
| Any coach | Owner + all Operators |

Status changes (Full / Modified / Out) are Operator-level, and every change writes `status_log` + `audit_log` with who made it. `avail.clear_by` is recorded as the clearance source on the change.
