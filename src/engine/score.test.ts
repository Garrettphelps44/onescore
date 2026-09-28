import { describe, expect, it } from 'vitest'
import { athlete, emptyHistory, rulesSTS, taps } from './__fixtures__/rules'
import { addDays } from './dates'
import { RuleError } from './rules'
import { readiness, scoreDay, sleepHoursFor } from './score'
import type { Checkin, History } from './types'

// Test numbers follow docs/06-vault-check-and-tests.md.
// 2026-06-08 = Monday, off-season week 2, Lift Day A, weekly test day. Yesterday was Off.
const MON = '2026-06-08'

function history(extra: Partial<History> = {}): History {
  return { ...emptyHistory(), ...extra }
}

/** Constant daily load for `days` days before `date`. */
function loads(date: string, from: number, to: number, load: number) {
  const out = []
  for (let i = from; i <= to; i++) out.push({ date: addDays(date, -i), load })
  return out
}

describe('scoreDay — scoring (rulesSTS)', () => {
  it('7. all 4s, no history, nutrition hit → readiness 77.5 → score 78 → Green', () => {
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(MON, 4)] }), MON)!
    expect(r.readiness).toBe(77.5)
    expect(r.score).toBe(78)
    expect(r.zone).toBe('green')
  })

  it('8. trend pulls down: prior 7 days readiness 50, today 77.5 → 67 → Yellow', () => {
    // Taps worth exactly 50: sleep hours 5, soreness 4, the rest 1, nutrition hit → (100 + 60) / 4 + 10.
    const fifty = (date: string): Checkin => ({ date, sleepHours: 5, sleepQuality: 1, soreness: 4, stress: 1, energy: 1, nutritionHit: true })
    expect(readiness(rulesSTS, fifty(MON))).toBe(50)
    const prior = [1, 2, 3, 4, 5, 6, 7].map((i) => fifty(addDays(MON, -i)))
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [...prior, taps(MON, 4)] }), MON)!
    expect(r.trend).toBe(50)
    expect(r.score).toBe(67)
    expect(r.zone).toBe('yellow')
  })

  it('9. test drop: base 24.0, latest 22.2 (7.5% drop) → −10 points', () => {
    const base = { ...taps(addDays(MON, -8), 4), testValue: 24.0 }
    const today = { ...taps(MON, 4), testValue: 22.2 }
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [base, today] }), MON)!
    expect(r.testAdj).toBe(-10)
  })

  it('10. A:C high: acute 1,200, chronic 700 (1.71) with a Green score → Yellow, load jump flag', () => {
    const dayLoads = [...loads(MON, 1, 7, 1200), ...loads(MON, 8, 28, 11200 / 21)]
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(MON, 5)], dayLoads }), MON)!
    expect(r.ac.ratio).toBeCloseTo(1.714, 3)
    expect(r.score).toBe(100)
    expect(r.zone).toBe('yellow')
    expect(r.flags).toContain('load_jump')
  })

  it('11. day after a game: score 90+ → Yellow', () => {
    const sun = '2026-06-14' // Saturday 06-13 is a Game day
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(sun, 5)] }), sun)!
    expect(r.score).toBeGreaterThanOrEqual(90)
    expect(r.zone).toBe('yellow')
    expect(r.caps).toContain('post_game')
  })

  it('12. build day: Green, A:C 0.7, off-season, not a new lifter → build', () => {
    const dayLoads = [...loads(MON, 1, 7, 700), ...loads(MON, 8, 28, 1100)]
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(MON, 5)], dayLoads }), MON)!
    expect(r.ac.ratio).toBeCloseTo(0.7, 5)
    expect(r.zone).toBe('green')
    expect(r.build).toBe(true)
  })

  it('12b. no build day for a new lifter when build days are for everyone past new', () => {
    const dayLoads = [...loads(MON, 1, 7, 700), ...loads(MON, 8, 28, 1100)]
    const r = scoreDay(rulesSTS, { ...athlete, trainingAge: 0.5 }, history({ checkins: [taps(MON, 5)], dayLoads }), MON)!
    expect(r.build).toBe(false)
  })

  it('13. coach override wins: override to Red → zone Red, score unchanged', () => {
    const plain = scoreDay(rulesSTS, athlete, history({ checkins: [taps(MON, 5)] }), MON)!
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(MON, 5)], overrides: [{ date: MON, zone: 'red' }] }), MON)!
    expect(r.zone).toBe('red')
    expect(r.score).toBe(plain.score)
    expect(r.flags).toContain('override')
  })
})

describe('scoreDay — modifiers and flags', () => {
  it('stress window caps at Yellow', () => {
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(MON, 5)], stressWindows: [{ start: MON, end: MON }] }), MON)!
    expect(r.zone).toBe('yellow')
  })

  it('sleep tap 1 counts as 5.9 hours; taps 2–5 count as their value', () => {
    expect(sleepHoursFor(rulesSTS, 1)).toBeCloseTo(5.9)
    expect(sleepHoursFor(rulesSTS, 2)).toBe(6)
    expect(sleepHoursFor(rulesSTS, 5)).toBe(9)
  })

  it('sleep flag: 3 nights under 7 hours → flag (STS: coach conversation, no cap)', () => {
    const short = (d: string): Checkin => ({ ...taps(d, 5), sleepHours: 2 })
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [0, 1, 2].map((i) => short(addDays(MON, -i))) }), MON)!
    expect(r.flags).toContain('sleep')
    expect(r.caps).not.toContain('sleep')
  })

  it('game day in Yellow or Red → game_day_zone flag', () => {
    const sat = '2026-06-13'
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(sat, 3)] }), sat)!
    expect(r.zone).toBe('yellow')
    expect(r.flags).toContain('game_day_zone')
  })

  it('Yellow streak flag after override.yellow_streak Yellow days', () => {
    const pastZones = [1, 2].map((i) => ({ date: addDays(MON, -i), zone: 'yellow' as const }))
    const r = scoreDay(rulesSTS, athlete, history({ checkins: [taps(MON, 3)], pastZones }), MON)!
    expect(r.zone).toBe('yellow')
    expect(r.flags).toContain('yellow_streak')
  })

  it('no check-in → null', () => {
    expect(scoreDay(rulesSTS, athlete, history(), MON)).toBeNull()
  })
})

describe('never invent a default', () => {
  it('a missing rule stops with an error naming the key', () => {
    const rules = { ...rulesSTS }
    delete (rules as Record<string, unknown>)['score.green_min']
    expect(() => scoreDay(rules, athlete, history({ checkins: [taps(MON, 4)] }), MON)).toThrow(RuleError)
    expect(() => scoreDay(rules, athlete, history({ checkins: [taps(MON, 4)] }), MON)).toThrow('score.green_min')
  })

  it('an answer the engine does not understand stops with an error', () => {
    const rules = { ...rulesSTS, 'score.ac_high_action': 'Something else' }
    const dayLoads = [...loads(MON, 1, 7, 1200), ...loads(MON, 8, 28, 500)]
    expect(() => scoreDay(rules, athlete, history({ checkins: [taps(MON, 5)], dayLoads }), MON)).toThrow(RuleError)
  })
})
