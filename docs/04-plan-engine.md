# Plan Engine

Back to `CLAUDE.md` · Inputs: `docs/02-rules-contract.md`, `docs/03-scoring-engine.md` · Tests: `docs/06-vault-check-and-tests.md`

Pure function: `planDay(rules, athlete, scoreResult, history, date) → { dayType, phase, blocks[], nutrition, statusLine }`.
Each block: `{ key, title, items: [{ name, sets?, reps?, amount?, unit?, load?, anchor?, tags[] }], note? }`.
Reference implementation: `plan()` in `_reference/index.html` (hard-coded there — here every value comes from rules).

## 1. Phase and day type
- **Phase:** the phase whose `phase.<p>.start` (MM/DD) is the most recent on or before `date` (wrap across the year).
- **Day type:** `phase.<p>.week.<mon..sun>` → Lift / Practice / Game / Off.
- **Lift letter:** count Lift days earlier in the same week (Mon start) → 0 = A, 1 = B, 2 = C (4th+ wraps to A).
- **Week of phase:** `floor((date − phase start) / 7) + 1`. **Transition week** = week 1 and `phase.transition` = One step lower → −1 set on anchor and accessories (minimum 1).

## 2. Status first
A status change or coach override after check-in rebuilds today's plan and `daily_results` row. Earlier days are never rebuilt.
- `ath.status` = **Out** → `avail.out_plan`: Core 4 + rehab / Rehab only / Core 4 only. Rehab block note: "Follow your athletic trainer's plan today." Stop.
- **Modified** → build normally, then apply restrictions (section 9).
- **Returning** (status went Out → Full/Modified within the last few weeks): anchor % = min(prescribed %, `avail.rtt.start_pct` + `avail.rtt.step_pct` × weeks since return).

## 3. Blocks by day type
| Day type | Blocks |
|---|---|
| Off | none (nutrition only) |
| Game | per `team.gameday`: Core 4 + skill primer / Core 4 only / Nothing; then a Game block ("Log minutes and RPE after.") |
| Practice | Core 4 → skill and speed in `skill.order` (speed per `team.practice_speed`: None / Practice-day drill / Full) → strength per `team.practice_strength` (None / Reduced = Yellow strength rules / Full) → conditioning per `cond.practice` → Team Practice block |
| Lift | Core 4 → skill and speed in `skill.order` → Strength → Conditioning |

## 4. Core 4
Items `core4.1–4`: name, sets × dose. Red + `core4.red` = 1 set each → sets = 1.

## 5. Sport skill
Sport = `ath.sport`. Phases are facility-wide in v1, so both `phase.multisport` options resolve to `ath.sport`. Drills = `skill.sN.d1–3` for the matching `skill.sN.sport`. Amount scaling:
- Yellow × `skill.yellow_pct`% · Red: `skill.red_mode` Remove block, or Technique reps × `skill.red_pct`% (prefix "Technique: ") · Game day × `skill.game_pct`%.
Round up. Contact-tagged drills removed under a No contact restriction.

## 6. Speed
Base: `speed.<letter>.name/reps` on lift days, `speed.practice.*` on practice days. `reps += phase.<p>.speed_add`.
Yellow: `reps −= speed.yellow_minus`, floor at `speed.min_reps`; if ≤ 0 remove block. Red: `speed.red` Remove / Half reps (round up) / Same.

## 7. Strength (The Anchor Method)
- Anchor = `str.<letter>.anchor`, region `str.<letter>.anchor_region`. Max = `ath.max.<letter>`.
- **Dose:** Off-season → block row `ceil(weekOfPhase / 4)` (cap 5): `str.block.N.sets/reps/pct`. Other phases → `phase.<p>.anchor_sets/reps/pct`. Sets 0 → no strength block.
- **Load** = round to nearest 5 lb of max × pct. No max → `profile.no_max`: "Technique weight" or "Coach sets load" in the load column.
- **New lifter** (training age < `profile.new_years`) and `profile.new_plan` = Core 4 + anchor technique only → anchor 3 × 5 labeled "Technique weight", no accessories, no speed, no conditioning.
- **Accessories** `str.<letter>.accN`: sets from the sheet in off-season; other phases use `phase.<p>.acc_sets` (0 = none). Reps and load are text (e.g. "30s", "BW").
- **Zones:**
  - Green + build → anchor and accessories `+ str.build_sets`.
  - Yellow → anchor sets `+ str.yellow.anchor_sets`, load × `str.yellow.load_pct`%; accessory sets `+ str.yellow.acc_sets` (minimum 1).
  - Red → anchor `str.red.sets × str.red.reps @ str.red.pct`% of max; accessories per `str.red.acc`: Remove / 1 set each / Same.

## 8. Conditioning
`cond.<letter>`: name, amount, unit, type. Amount × `phase.<p>.cond_pct`% (0 = none). Skip if tomorrow is a Game and `cond.pregame` = None (Half = × 50%).
Yellow × `cond.yellow_pct`% (0 = remove). Red: `cond.red` None / Half. Round up.

## 9. Restrictions (Modified)
For each ticked restriction `ath.r.<tag>`, look up `avail.<tag>.action`:
- **Remove:** drop every item carrying the tag. Tag rules:
  - lower → Core 4 tagged Lower or Jump, strength items with region Lower or Full, speed block, conditioning type Run (→ swap, see below)
  - upper → Core 4 tagged Upper, strength items with region Upper or Full
  - sprint → speed block, conditioning type Run
  - jump → Core 4 tagged Jump
  - contact → skill drills with Contact ticked
- **Swap:** replace the anchor (when its region matches the tag) with `avail.<tag>.swap`, `avail.<tag>.sets × avail.<tag>.reps`, load "Coach sets load".
- Run-type conditioning removed by sprint/lower → replace with `cond.swap.name` × `cond.swap.amount cond.swap.unit` (scaled by zone like normal conditioning).
Status line on the athlete screen: "Modified: No sprinting, No jumping".

## 10. Nutrition
`bw = ath.bodyweight`. Calories = bw × `nutr.cal.<off|lift|practice|game>` (round to 10). Protein = bw × `nutr.protein` g. Fat = bw × `nutr.fat` g. Carbs = (calories − protein×4 − fat×9) ÷ 4 g, floor 0. Yellow/Red notes per `nutr.yellow` / `nutr.red` (e.g. "Protein first"). No bodyweight → hide targets and show "Ask your coach to add your bodyweight."
