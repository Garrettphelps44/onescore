# Scoring Engine

Back to `CLAUDE.md` · Inputs from: `docs/02-rules-contract.md` · Feeds: `docs/04-plan-engine.md` · Tests: `docs/06-vault-check-and-tests.md`

Pure function: `scoreDay(rules, athlete, history, date) → { score, zone, readiness, trend, testAdj, ac, flags[], caps[], build, reason }`.
`history` = check-ins, loads, test values, status changes, overrides before `date`. Reference implementation: `scoreFor()` in `_reference/index.html`.

## 1. Readiness (today)
Check-in taps are 1–5 (5 = best for every item). Sleep hours tap *i* means the band defined by `sleep.tap1..5`. Where hours are needed (sleep flag), tap 1 = `sleep.tap1 − 0.1` ("under 6" → 5.9); taps 2–5 = their value.
```
w = score.w.* (sleep_hours, sleep_quality, soreness, stress, energy, nutrition)
readiness = Σ w_k × (tap_k − 1) / 4   for the five taps
          + (nutrition_hit ? w.nutrition : 0)
readiness = readiness / Σw × 100
```
If `nutr.miss` = "No score impact": drop the nutrition weight from both sums.

## 2. Trend
`t = score.trend_pct / 100`. `prior = mean(readiness of the previous 7 days that have a check-in)`.
`score = prior exists ? (1 − t) × readiness + t × prior : readiness`

## 3. Testing adjustment
- The test box shows on `test.weekly.day` regardless of zone. `test.yellow` / `test.red` are not used in v1.
- `latest` = most recent weekly test value in the last 7 days (including today).
- `base` = mean of test values from day −8 back to day −`test.baseline_days`. If none, use `athlete.test_baseline`.
- `drop` = `test.weekly.better` = Higher ? (base − latest) / base : (latest − base) / base
- drop ≥ `test.drop2.pct`% → score −= `test.drop2.pts`; else drop ≥ `test.drop1.pct`% → score −= `test.drop1.pts`.
Clamp 0–100, round.

## 4. Zone
`score ≥ score.green_min` → Green · `≥ score.yellow_min` → Yellow · else Red.

## 5. Training load and A:C
Daily load (stored when a session is saved):
- Training session: `(tonnage / score.tonnage_divisor + minutes) × RPE`. Tonnage = Σ sets × reps × load of the *prescribed* strength items (numeric reps and loads only).
- Practice / game: `minutes × RPE` (`team.load_method` = Athlete RPE) or `minutes × coach intensity tag` (Coach tag: coach enters one 1–10 value per team per day on the coach screen).
- Day load = sum of that day's sessions.
```
acute   = Σ load over previous score.acute_days   / score.acute_days
chronic = Σ load over previous score.chronic_days / score.chronic_days
ac      = chronic > 0 ? acute / chronic : null
```
Days without a log count as 0.

## 6. Modifiers — apply in this order
1. **A:C high:** `ac > score.ac_high` → `score.ac_high_action`: Drop one zone / Cap at Yellow / Flag coach only (flag, no zone change).
2. **Day after a game:** yesterday's day type = Game → cap at `team.postgame_cap` (Yellow / Red / No cap).
3. **Stress window:** date inside a coach-set stress window and `stress.window_cap` = Cap at Yellow → cap at Yellow.
4. **Pattern flags** (each adds a flag; "Cap at Yellow" or "Both" also caps):
   - Sleep: last `sleep.flag.nights` nights all under `sleep.flag.under` hrs → `sleep.flag.action`
   - Stress: stress tap ≤ `stress.flag.level` for `stress.flag.days` days → `stress.flag.action`
   - Soreness: soreness tap ≤ `body.flag.level` for `body.flag.days` days → `body.flag.action`
5. **Build day:** zone = Green AND `ac < score.ac_low` AND `score.ac_low_action` = Build day AND current phase `build` = Yes AND athlete allowed by `profile.build_for` (Everyone = not a new lifter; Advanced only = training age ≥ `profile.adv_years`; No one).
6. **Coach override** for that date replaces the zone (keeps the score number).

"Cap at X" means: if the zone is better than X, set it to X. "Drop one zone": Green→Yellow, Yellow→Red, Red stays Red.

## 7. Coach flags (for the board, not the athlete)
Red today · Yellow or Red on a game day (`game_day_zone`) · Yellow streak ≥ `override.yellow_streak` · sleep/stress/soreness flags · A:C flag · missed check-in · status Modified/Out.

## 8. Reason
One line for the coach view (and the athlete only if `override.athlete_sees` = Score + plan + reason). Lead with the modifier that changed the zone, else the two lowest taps. Wording pattern: see `reason()` in the prototype.
