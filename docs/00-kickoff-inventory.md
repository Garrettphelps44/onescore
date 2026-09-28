# Kickoff Inventory

Back to `CLAUDE.md` · Output of the Kickoff Prompt, 2026-09-28 · Decisions from it are logged in `VAULT-PLAN.md`

## Modules
| # | Module | Scope |
|---|---|---|
| L1 | Rules Import | Upload 16 PDFs → decisions (60, 25 set-only keys) → program → advanced overrides → validate → `rules_versions` (+ `raw`) → diff |
| L2 | Roster & Intake | Add/edit/deactivate, Intake PDF (21 fields, `birth_year` not age), `profile.req.*` required fields, consent on roster, invite |
| L3 | Engine | `scoreDay` + `planDay` + load formula. Pure TS, tests 7–21 in `06-vault-check-and-tests.md` |
| L4 | Athlete Today | Check-in, number-only slab, collapsible blocks, Save session, nutrition entry, PWA |
| L5 | Availability | Full/Modified/Out + restrictions → `status_log` + `audit_log`, return-to-train, same-day rebuild |
| L6 | Coach Board & Detail | Red-first board + flags, 28-day chart, overrides gated by `override.who` (same-day rebuild) |
| L7 | Settings | Invites, stress windows, practice intensity, Operator titles |
| L8 | Reporting & Share | Parent report share link (one athlete, expires), Owner audit view |

## Draft → Vault, function by function
| Draft | Verdict | Notes |
|---|---|---|
| `readiness()` | Port structure | Weights ← `score.w.*`; `nutr.miss` can drop nutrition weight |
| `acwr()` | Port structure | 7/28 ← `score.acute_days` / `score.chronic_days` |
| `jumpMod()` | Rebuild | Any test, `test.weekly.better`, two drop tiers, `test.baseline_days` |
| `scoreFor()` | Port flow, add | Draft has 2 of 6 modifiers. Add A:C action choice, postgame cap options, stress windows, pattern flags, `profile.build_for`, overrides |
| `reason()` | Port wording pattern | UI copy, fine to keep as code |
| `plan()` | Mostly rebuild | Draft hard-codes phases, 3 anchors, name-regex jump detection. Rules use tags, block table, phase doses, swaps |
| `tonnage()` | Port as-is | |
| `nutrTargets()` | Port formula | Multipliers ← `nutr.*` |
| `recalcLoad()` | Port formula | `/100` ← `score.tonnage_divisor` |
| Athlete screen + CSS tokens + `LOGO` | Match layout, rewrite in React | |
| `chart()` | Rebuild as component | |
| Coach tab settings, demo controls, seed | Cut | |

## Proposed schema additions (to confirm in phase A)
Beyond `05-schema-and-access.md`:
- **Tenant Lock exceptions, documented:** `tenants` (is the tenant) and `architects` (outside the tenant model).
- `tenant_members` unique (tenant_id, user_id)
- `invites` + created_by · `share_tokens` + created_by, revoked_at · `audit_log` + details jsonb
- `rules_versions` unique (tenant_id, version)
- `athlete_restrictions` unique (athlete_id, restriction)
- `checkins.sleep_hours` stores the tap (1–5), not hours
- `sessions` unique (athlete_id, date, kind) · `team_intensity` unique (tenant_id, date, sport, kind)
- `daily_results` unique (athlete_id, date) + readiness, ac, reason, build
- RLS helpers beyond the doc: `active_rules(t)`, `can_override(t)` (reads the tenant's `override.who` + the member's `title`)
