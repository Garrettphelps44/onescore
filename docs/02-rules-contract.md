# Rules Contract

Back to `CLAUDE.md` · Used by: `docs/03-scoring-engine.md`, `docs/04-plan-engine.md` · Stored in: `docs/05-schema-and-access.md`

The sheets are the program. This note defines how filled PDFs become one `rules` object.

## Source files
- `_reference/sheets/01–16` — facility sheets. `17-athlete-intake.pdf` — one per athlete.
- `_reference/field-map.json` — **the contract.** Every field key, type, options, required flag, layer, and every decision with what each answer sets.
- `_reference/reference-importer.py` — the same logic in Python. Port it to TypeScript (`src/import/`).

## Field name = rule key
Every PDF form field is named with its rule key, e.g. `score.green_min`, `str.a.anchor`, `dec.score.caution`. Read fields with `pdfjs-dist` (`getFieldObjects()`).

## Layers
| Layer | Keys | Import behavior |
|---|---|---|
| 1 Philosophy | `sNN.phil.*` | Saved to `philosophy` (text). Never used by the engine. |
| 2 Decision | `dec.*` | Required. Value = option label. Look up the option in `field-map.json → decisions`; copy its `sets` into rules. |
| 3 Program | everything else not advanced | Read as-is. Required if `required: true`. |
| 4 Advanced | `layer: "advanced"` | Optional. If filled, overrides what the decision set. |
| Meta | `sNN.meta.*` | Facility / completed by / date. Saved for the audit trail. |

## Resolve order
1. Apply every decision's `sets`.
2. Apply program fields.
3. Apply filled advanced fields (override).
4. If a decision option has empty `sets` (Strength → Custom), its advanced fields become required.

## Value types
- `number` → parse float. Not a number → error "`<label>`: 'abc' is not a number".
- `choice` / `decision` → exact option text. Blank option is a single space: treat `" "` as empty.
- `check` → `/Yes` = true, anything else = false.
- `text` → trimmed string.

## Validation (block the import, list every problem in plain language)
- Any required field empty → "`<Sheet title>`: `<question or label>` is empty."
- Score weights (if any advanced weight is filled) must all be filled and total 100.
- `score.yellow_min` < `score.green_min`.
- Sport 1 on Sport Skill filled; every sport with a name has 3 drills.
- Anchor for Day A required. Day B / C required if the week template for any phase has 2 / 3 Lift days.
- Every phase has a start date (MM/DD) and all 7 week days.
- `profile.new_years` < `profile.adv_years`.
- Athlete Intake: `ath.sport` must match a sport name on Sport Skill (case-insensitive).
- Re-import: every sport an active athlete is on must still exist on Sport Skill. If not, block the import and name those athletes.

## Versioning
Rules belong to one tenant. Each successful import creates a new `rules_versions` row with that `tenant_id`. The app always uses the latest. Plans already generated keep the version they were built with (`daily_results.rules_version`). The Import screen shows a diff: "Green starts at: 75 → 80".

The raw field values read from the PDFs are saved on the version (`rules_versions.raw`) so an import can be audited or re-resolved. The PDF files themselves are not stored.

## Never
- Never fill a missing rule with a default. The prototype's numbers are examples only.
- Never hard-code a sport, exercise, or threshold in `src/`.

## Role mapping for `override.who`
The sheet speaks coach language. The app enforces it with the Four Roles and the Operator `title`:
| Sheet answer | Who can override (enforced in RLS) |
|---|---|
| Head coach only | Owner |
| Head coach + athletic trainer | Owner + Operators with title = athletic trainer |
| Any coach | Owner + all Operators |

Status changes (Full / Modified / Out) are Operator-level, and every change writes `status_log` + `audit_log` with who made it. `avail.clear_by` is recorded as the clearance source on the change.
