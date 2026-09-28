# Schema & Access

Back to `CLAUDE.md` · Phase A and U in `VAULT-PLAN.md` · Checked by `docs/06-vault-check-and-tests.md`

## The Four Roles
| Role | Who in One Score | Sees | Can |
|---|---|---|---|
| **Architect** | Garrett / STS | Every tenant. Lives outside the tenant model (`architects` table). | Create, suspend, comp, support tenants. Fill Layer 4 during installs. |
| **Owner** | Facility owner or head coach | Everything in their tenant | Import sheets, roster, invites, branding, billing, settings, everything an Operator can do |
| **Operator** | Coaches, athletic trainers (`title`) | Every athlete in their tenant | Board, athlete detail, status/restrictions, overrides (per `override.who`), stress windows, practice intensity |
| **Athlete** | The athlete | Only their own record | Check in, see score + plan, log sessions and nutrition |

Roles are enforced in RLS. Never by hiding a button.

## Vault base tables (every Install starts here)
| Table | Holds |
|---|---|
| `tenants` | id, name, timezone, subscription_status, created_at |
| `tenant_members` | tenant_id, user_id, role (`owner`,`operator`,`athlete`), title (`head coach`,`coach`,`athletic trainer`, null), created_at |
| `tenant_branding` | tenant_id, display_name, logo_url, accent_color, accent_dim |
| `invites` | id, tenant_id, email, role, title, athlete_id (athlete invites), token, expires_at, accepted_at |
| `audit_log` | id, tenant_id, user_id, action, target, created_at |
| `share_tokens` | id, tenant_id, record_id (athlete_id), purpose (`parent_report`), token, expires_at |
| `architects` | user_id — outside the tenant model |

## One Score domain tables (every one carries `tenant_id`)
| Table | Columns (key ones) | Notes |
|---|---|---|
| `rules_versions` | id, tenant_id, version, rules jsonb, raw jsonb, philosophy jsonb, meta jsonb, imported_by, imported_at | Latest = active. `rules` is resolved key→value from the sheets; it is config, not user data, so jsonb is right here. |
| `athletes` | id, tenant_id, user_id (null until invite accepted), name, sport, sport2, position, grade, birth_year, bodyweight, training_age, max_a, max_b, max_c, test_baseline, status (`full`,`modified`,`out`), status_changed_at, injury, parent_name, parent_contact, parent_consent_at, active | Real columns, not a blob |
| `athlete_restrictions` | tenant_id, athlete_id, restriction (`lower`,`upper`,`sprint`,`jump`,`contact`) | One row per active restriction |
| `checkins` | id, tenant_id, athlete_id, date, sleep_hours, sleep_quality, soreness, stress, energy (1–5), nutrition_hit, test_value | unique (athlete_id, date) |
| `sessions` | id, tenant_id, athlete_id, date, kind (`training`,`practice`,`game`), minutes, rpe, tonnage, load | Load computed by the engine |
| `team_intensity` | id, tenant_id, date, sport, kind, intensity (1–10), entered_by | Only when `team.load_method` = Coach tag |
| `nutrition_logs` | id, tenant_id, athlete_id, date, calories, protein, carbs, fat | unique (athlete_id, date) |
| `overrides` | id, tenant_id, athlete_id, date, from_zone, to_zone, reason, user_id | |
| `stress_windows` | id, tenant_id, start_date, end_date, label | |
| `daily_results` | id, tenant_id, athlete_id, date, rules_version, score, zone, flags jsonb, plan jsonb, nutrition jsonb | Snapshot at check-in so history never changes when rules change. Rebuilt the same day on a status change or override. |
| `status_log` | id, tenant_id, athlete_id, status, restrictions text[], cleared_by_source, user_id, changed_at | Availability audit trail |

Dates are the tenant's local date (`tenants.timezone`).

## RLS pattern (one policy set per table)
- Helper functions: `is_architect()`, `member_role(tenant_id)`, `my_athlete_id(tenant_id)`.
- **Architect:** read/write all.
- **Owner:** read/write rows where `tenant_id` = their tenant.
- **Operator:** read all athlete data in their tenant; write `athletes` (status only), `athlete_restrictions`, `overrides` (if allowed by the tenant's `override.who` + their `title`), `stress_windows`, `team_intensity`, `status_log`. No `tenant_branding`, `invites`, `rules_versions` writes, no billing.
- **Athlete:** read/write only their own `checkins`, `sessions`, `nutrition_logs`; read only their own `athletes` row and `daily_results`; read the active `rules_versions` of their tenant (engine needs it). Nothing else.
- **Subscription gate (phase T):** every domain policy also requires `tenants.subscription_status` in (`active`,`trialing`,`comped`).
- **Share links:** a public Edge Function takes a token, checks `share_tokens` (not expired), returns exactly one athlete's report. Tokens never grant table access.

## Auth (phase U)
- Supabase email + password, 8-character minimum, real email addresses. No local or fallback login.
- Signup → creates `tenants` row + `tenant_members` row with role `owner` (one transaction, Edge Function).
- Invites → email with token link, expires (default 7 days). Accepting links the user to the tenant, role, and (for athletes) `athletes.user_id`.
- Minors: athlete invite can go to a parent's email; the parent sets the password with the athlete. See `docs/07-privacy.md`.
- Every sign-in-sensitive action writes `audit_log` (role change, invite, status change, override, rules import, share link created).

## Secrets
Stripe secret key, service role key, email provider key → Edge Function environment only. Browser code gets the Supabase URL and anon key, nothing else.
