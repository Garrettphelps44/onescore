# Vault Check & Tests

Back to `CLAUDE.md` · Specs: `docs/02-rules-contract.md`, `docs/03-scoring-engine.md`, `docs/04-plan-engine.md`, `docs/05-schema-and-access.md`

## The Vault Check — run before any real customer touches the Install
- [ ] Log in as Tenant B. Walk every screen — any trace of Tenant A's data is a bug.
- [ ] Try to query another tenant's records directly, bypassing the UI. Should return empty.
- [ ] Log in as an Athlete. Try to reach an Operator screen by URL. Should be blocked.
- [ ] Log in as an Operator. Try to reach Settings, Import, and Billing by URL and by direct query. Should be blocked.
- [ ] Open a share link logged out, in a private window. Exactly one athlete's report, nothing else reachable.
- [ ] Let a share token expire. Confirm it stops working.
- [ ] Set a tenant's `subscription_status` to `canceled`. Confirm data access stops at the database.
- [ ] Search the whole codebase for keys and secrets. Anything in browser code is exposed.
- [ ] Confirm the deploy's environment variables point where you think — Netlify and Supabase, easy to mismatch.

## Isolation Lock test (automated — rerun every schema change)
Two dummy tenants, one Owner + one Operator + one Athlete each. For every table, each user attempts to read and write the other tenant's rows → 0 rows / denied.

## Rules import tests
1. **Blank sheet fails clearly.** Blank Scoring sheet → errors include "How cautious are you with a tired athlete?". Nothing saved.
2. **Full set passes.** All 16 sheets filled with STS answers → 0 errors, version 1 saved.
3. **Advanced overrides decision.** STS answers + advanced `score.green_min` = 82 → rules.green_min = 82, yellow_min = 55.
4. **Custom block requires the table.** Strength block = Custom with empty block table → error; filled → imports.
5. **Weights must total 100.** Advanced weights filled summing to 90 → error.
6. **Intake sport must exist.** Athlete sport "Lacrosse" not on Sport Skill → error naming the athlete.

## Engine tests — scoring (rulesSTS)
7. **All 4s, no history, nutrition hit** → readiness 77.5 → score 78 → Green.
8. **Trend pulls down.** Prior 7 days readiness 50, today 77.5 → score 66.5 → 67 → Yellow.
9. **Test drop.** Base 24.0, latest 22.2 (7.5% drop) → −10 points.
10. **A:C high.** acute 1,200, chronic 700 (1.71) with Green score → Yellow, flag "load jump".
11. **Day after game.** Yesterday Game, score 90 → Yellow.
12. **Build day.** Green, A:C 0.7, off-season, not a new lifter → build = true.
13. **Override wins.** Coach override to Red → zone Red, score number unchanged.

## Engine tests — plan (rulesSTS, off-season, Monday = Lift Day A)
14. **Green Day A.** Anchor = str.a.anchor, week 1 → block row 1 dose, load = max × pct rounded to 5.
15. **Yellow.** Anchor sets −1, load × 90%, accessories −1 set, speed −2 reps, conditioning × 50%.
16. **Red.** Anchor 3 × 3 @ 60%, no accessories, no speed, no conditioning, skill = "Technique:" at 50%.
17. **Practice day.** No strength, practice speed drill, no conditioning, Team Practice block.
18. **Modified: No sprinting.** No speed block; Run conditioning swapped to cond.swap.
19. **Out.** Core 4 + Rehab block only.
20. **No bodyweight.** Nutrition shows the "ask your coach" message instead of targets.

## The Two Coaches test (proves nothing is hard-coded)
21. Same athlete, same history, same check-in (all 3s). `rulesSTS` vs `rulesProtect` → different zone **or** different plan. If they match, a value is hard-coded — find it.


## Fixtures
`rulesSTS` = every decision resolved with its "(STS)" option. `rulesProtect` = every "Protect / cautious" option. Generate both from `_reference/field-map.json`.
