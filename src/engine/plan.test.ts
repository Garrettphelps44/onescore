import { describe, expect, it } from 'vitest'
import { athlete, emptyHistory, rulesProtect, rulesSTS, taps } from './__fixtures__/rules'
import { sessionLoad, teamLoad, tonnage } from './load'
import { planDay } from './plan'
import { scoreDay } from './score'
import type { Athlete, Block, History, Rules } from './types'

// Test numbers follow docs/06-vault-check-and-tests.md.
// 2026-06-08 = Monday, off-season week 2 (block row 1: 3 × 5 @ 70%), Lift Day A.
// Week 2 avoids the week-1 transition, which has its own test below.
const MON = '2026-06-08'
const TUE = '2026-06-09' // Practice
const SAT = '2026-06-13' // Game

/** Score from one check-in (all taps = v), then plan. 5 → Green, 3 → Yellow, 1 + missed → Red. */
function day(date: string, v: number, a: Athlete = athlete, rules: Rules = rulesSTS, extra: Partial<History> = {}) {
  const history = { ...emptyHistory(), checkins: [taps(date, v, v !== 1)], ...extra }
  const score = scoreDay(rules, a, history, date)!
  return { score, plan: planDay(rules, a, score, history, date) }
}
const block = (blocks: Block[], key: Block['key']) => blocks.find((b) => b.key === key)
const keys = (blocks: Block[]) => blocks.map((b) => b.key)

describe('planDay (rulesSTS, off-season)', () => {
  it('14. Green Day A: anchor = str.a.anchor, block row 1 dose, load = max × pct rounded to 5', () => {
    const { score, plan } = day(MON, 5)
    expect(score.zone).toBe('green')
    expect(plan.letter).toBe('a')
    expect(keys(plan.blocks)).toEqual(['core4', 'skill', 'speed', 'strength', 'cond'])
    const anchor = block(plan.blocks, 'strength')!.items[0]
    expect(anchor).toMatchObject({ name: 'Back Squat', sets: 3, reps: 5, load: 210, anchor: true })
  })

  it('15. Yellow: anchor −1 set, load × 90%, accessories −1 set, speed −2 reps, conditioning × 50%', () => {
    const { score, plan } = day(MON, 3)
    expect(score.zone).toBe('yellow')
    const [anchor, ...acc] = block(plan.blocks, 'strength')!.items
    expect(anchor).toMatchObject({ sets: 2, reps: 5, load: 190 }) // 300 × 70% × 90% = 189 → 190
    expect(acc.map((i) => i.sets)).toEqual([2, 2, 2])
    expect(block(plan.blocks, 'speed')!.items[0].reps).toBe(4)
    expect(block(plan.blocks, 'cond')!.items[0].amount).toBe(4)
  })

  it('16. Red: anchor 3 × 3 @ 60%, no accessories, no speed, no conditioning, skill "Technique:" at 50%', () => {
    const { score, plan } = day(MON, 1)
    expect(score.zone).toBe('red')
    const strength = block(plan.blocks, 'strength')!
    expect(strength.items).toHaveLength(1)
    expect(strength.items[0]).toMatchObject({ sets: 3, reps: 3, load: 180 })
    expect(block(plan.blocks, 'speed')).toBeUndefined()
    expect(block(plan.blocks, 'cond')).toBeUndefined()
    const skill = block(plan.blocks, 'skill')!.items
    expect(skill.map((i) => i.name.startsWith('Technique: '))).toEqual([true, true, true])
    expect(skill.map((i) => i.amount)).toEqual([3, 3, 10])
  })

  it('17. Practice day: no strength, practice speed drill, no conditioning, Team Practice block', () => {
    const { plan } = day(TUE, 5)
    expect(plan.dayType).toBe('Practice')
    expect(keys(plan.blocks)).toEqual(['core4', 'skill', 'speed', 'practice'])
    expect(block(plan.blocks, 'speed')!.items[0]).toMatchObject({ name: '10 yd acceleration', reps: 4 })
  })

  it('18. Modified, No sprinting: no speed block; Run conditioning swapped to cond.swap', () => {
    const { plan } = day(MON, 5, { ...athlete, status: 'modified', restrictions: ['sprint'] })
    expect(block(plan.blocks, 'speed')).toBeUndefined()
    expect(block(plan.blocks, 'cond')!.items[0]).toMatchObject({ name: 'Bike sprint 15 sec', amount: 10 })
    expect(plan.statusLine).toBe('Modified: No sprinting')
  })

  it('19. Out: Core 4 + Rehab only', () => {
    const { plan } = day(MON, 5, { ...athlete, status: 'out' })
    expect(keys(plan.blocks)).toEqual(['core4', 'rehab'])
    expect(plan.statusLine).toBe('Out')
  })

  it('20. No bodyweight: nutrition shows the "ask your coach" message instead of targets', () => {
    const { plan } = day(MON, 5, { ...athlete, bodyweight: null })
    expect(plan.nutrition.targets).toBeNull()
    expect(plan.nutrition.note).toBe('Ask your coach to add your bodyweight.')
  })
})

describe('The Two Coaches test', () => {
  it('21. same athlete, same check-in (all 3s): rulesSTS vs rulesProtect → different zone or plan', () => {
    const sts = day(MON, 3, athlete, rulesSTS)
    const protect = day(MON, 3, athlete, rulesProtect)
    const differs = sts.score.zone !== protect.score.zone || JSON.stringify(sts.plan) !== JSON.stringify(protect.plan)
    expect(differs).toBe(true)
  })
})

describe('planDay — more behaviors', () => {
  it('week 1 of a phase eases in: −1 set on anchor and accessories', () => {
    const { plan } = day('2026-06-01', 5)
    const [anchor, ...acc] = block(plan.blocks, 'strength')!.items
    expect(anchor.sets).toBe(2)
    expect(acc.map((i) => i.sets)).toEqual([2, 2, 2])
  })

  it('Green + build adds str.build_sets', () => {
    const history = { ...emptyHistory(), checkins: [taps(MON, 5)] }
    const score = { ...scoreDay(rulesSTS, athlete, history, MON)!, build: true }
    const plan = planDay(rulesSTS, athlete, score, history, MON)
    expect(block(plan.blocks, 'strength')!.items[0].sets).toBe(4)
  })

  it('game day: normal game-day skill % whatever the zone', () => {
    const green = day(SAT, 5).plan
    const yellow = day(SAT, 3).plan
    expect(keys(green.blocks)).toEqual(['core4', 'skill', 'game'])
    expect(block(yellow.blocks, 'skill')!.items.map((i) => i.amount)).toEqual(block(green.blocks, 'skill')!.items.map((i) => i.amount))
    expect(block(green.blocks, 'skill')!.items.map((i) => i.amount)).toEqual([3, 3, 10]) // 50%
  })

  it('practice letter: Next lift day borrows the next lift day; Day A always A', () => {
    const light: Rules = { ...rulesSTS, 'team.practice_strength': 'Reduced' }
    const next = day(TUE, 5, athlete, light).plan // next lift is Wed = Day B
    expect(block(next.blocks, 'strength')!.items[0].name).toBe('Bench Press')
    expect(block(next.blocks, 'strength')!.items[0].sets).toBe(2) // Reduced = Yellow strength rules
    const dayA = day(TUE, 5, athlete, { ...light, 'team.practice_letter': 'Day A' }).plan
    expect(block(dayA.blocks, 'strength')!.items[0].name).toBe('Back Squat')
  })

  it('Modified, No lower body with Swap: anchor swapped, lower accessories and lower Core 4 removed', () => {
    const { plan } = day(MON, 5, { ...athlete, status: 'modified', restrictions: ['lower'] })
    const strength = block(plan.blocks, 'strength')!.items
    expect(strength.map((i) => i.name)).toEqual(['Bench Press', 'Plank'])
    expect(strength[0].load).toBe('Coach sets load')
    expect(block(plan.blocks, 'core4')!.items.map((i) => i.name)).toEqual(['90/90 Hip Switch'])
    expect(block(plan.blocks, 'speed')).toBeUndefined()
  })

  it('Modified, No contact: contact drills removed', () => {
    const { plan } = day(MON, 5, { ...athlete, status: 'modified', restrictions: ['contact'] })
    expect(block(plan.blocks, 'skill')!.items.map((i) => i.name)).not.toContain('Ball security and catching')
  })

  it('returning from Out: anchor % capped at start + step × weeks back', () => {
    const extra = { statusChanges: [{ date: '2026-05-20', status: 'out' as const }, { date: '2026-06-01', status: 'full' as const }] }
    const { plan } = day(MON, 5, athlete, rulesSTS, extra) // 1 week back → min(70, 60 + 10) = 70
    expect(block(plan.blocks, 'strength')!.items[0].load).toBe(210)
    const early = day(MON, 5, athlete, rulesSTS, { statusChanges: [{ date: '2026-05-20', status: 'out' }, { date: '2026-06-05', status: 'full' }] })
    expect(block(early.plan.blocks, 'strength')!.items[0].load).toBe(180) // 0 weeks back → 60%
  })

  it('new lifter on "technique only": Core 4 + skill + anchor technique, nothing else', () => {
    const { plan } = day(MON, 5, { ...athlete, trainingAge: 0 })
    expect(keys(plan.blocks)).toEqual(['core4', 'skill', 'strength'])
    expect(block(plan.blocks, 'strength')!.items).toEqual([expect.objectContaining({ sets: 3, reps: 5, load: 'Technique weight' })])
  })

  it('no max on file: load follows profile.no_max', () => {
    const { plan } = day(MON, 5, { ...athlete, maxes: { a: null, b: null, c: null } })
    expect(block(plan.blocks, 'strength')!.items[0].load).toBe('Technique weight')
  })

  it('off day: no blocks, nutrition only', () => {
    const { plan } = day('2026-06-11', 5)
    expect(plan.blocks).toEqual([])
    expect(plan.nutrition.targets).not.toBeNull()
  })

  it('nutrition targets from bodyweight and day type', () => {
    const { plan } = day(MON, 5) // Lift: 180 × 18 = 3240
    expect(plan.nutrition.targets).toEqual({ calories: 3240, protein: 180, fat: 72, carbs: 468 }) // (3240 − 720 − 648) ÷ 4
  })
})

describe('load', () => {
  it('session load = (tonnage ÷ divisor + minutes) × RPE; tonnage counts numeric items only', () => {
    const { plan } = day(MON, 5)
    const t = tonnage(plan.blocks) // 3×5×210 + 3×8×135 + 3×8×35 = 3150 + 3240 + 840
    expect(t).toBe(7230)
    expect(sessionLoad(rulesSTS, t, 60, 7)).toBeCloseTo((72.3 + 60) * 7)
  })

  it('practice load uses athlete RPE or coach intensity per team.load_method', () => {
    expect(teamLoad(rulesSTS, 90, 6, null)).toBe(540)
    const coach = { ...rulesSTS, 'team.load_method': 'Coach intensity tag x minutes' }
    expect(teamLoad(coach, 90, null, 5)).toBe(450)
    expect(() => teamLoad(coach, 90, 6, null)).toThrow('coach intensity')
  })
})
