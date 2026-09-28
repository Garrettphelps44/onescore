import { addDays, dayTypeOn, phaseOn } from './dates'
import { acRatio } from './load'
import { num, pick } from './rules'
import type { Athlete, Checkin, Flag, History, Rules, ScoreResult, Zone } from './types'

// scoreDay: check-in → score → zone. Spec: docs/03-scoring-engine.md.

const TAPS = ['sleepHours', 'sleepQuality', 'soreness', 'stress', 'energy'] as const
const WEIGHT: Record<(typeof TAPS)[number], string> = {
  sleepHours: 'score.w.sleep_hours',
  sleepQuality: 'score.w.sleep_quality',
  soreness: 'score.w.soreness',
  stress: 'score.w.stress',
  energy: 'score.w.energy',
}
const RANK: Record<Zone, number> = { green: 2, yellow: 1, red: 0 }
const capAt = (z: Zone, cap: Zone): Zone => (RANK[z] > RANK[cap] ? cap : z)
const dropOne = (z: Zone): Zone => (z === 'green' ? 'yellow' : 'red')
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

/** Today's check-in as 0–100. */
export function readiness(rules: Rules, ci: Checkin): number {
  const countsNutrition =
    pick(rules, 'nutr.miss', ['Lose nutrition points', 'No score impact'] as const) === 'Lose nutrition points'
  let sum = 0
  let total = 0
  for (const t of TAPS) {
    const w = num(rules, WEIGHT[t])
    sum += (w * (ci[t] - 1)) / 4
    total += w
  }
  if (countsNutrition) {
    const w = num(rules, 'score.w.nutrition')
    if (ci.nutritionHit) sum += w
    total += w
  }
  return total > 0 ? (sum * 100) / total : 0
}

/** Hours a sleep tap stands for. Tap 1 means "under sleep.tap1" → tap1 − 0.1. */
export function sleepHoursFor(rules: Rules, tap: number): number {
  const v = num(rules, `sleep.tap${tap}`)
  return tap === 1 ? v - 0.1 : v
}

function testAdjustment(rules: Rules, athlete: Athlete, byDate: Map<string, Checkin>, date: string): number {
  let latest: number | null = null
  for (let i = 0; i <= 6 && latest == null; i++) latest = byDate.get(addDays(date, -i))?.testValue ?? null
  if (latest == null) return 0
  const base: number[] = []
  for (let i = 8; i <= num(rules, 'test.baseline_days'); i++) {
    const v = byDate.get(addDays(date, -i))?.testValue
    if (v != null) base.push(v)
  }
  const b = mean(base) ?? athlete.testBaseline
  if (!b) return 0
  const higherBetter = pick(rules, 'test.weekly.better', ['Higher', 'Lower'] as const) === 'Higher'
  const drop = ((higherBetter ? b - latest : latest - b) / b) * 100
  if (drop >= num(rules, 'test.drop2.pct')) return -num(rules, 'test.drop2.pts')
  if (drop >= num(rules, 'test.drop1.pct')) return -num(rules, 'test.drop1.pts')
  return 0
}

/** True when the last `days` check-ins (today back) all exist and all meet `test`. */
function streak(byDate: Map<string, Checkin>, date: string, days: number, test: (c: Checkin) => boolean) {
  for (let i = 0; i < days; i++) {
    const c = byDate.get(addDays(date, -i))
    if (!c || !test(c)) return false
  }
  return days > 0
}

export function isNewLifter(rules: Rules, athlete: Athlete): boolean {
  // Unknown training age is treated as new — the safer read.
  return athlete.trainingAge == null || athlete.trainingAge < num(rules, 'profile.new_years')
}

function buildAllowed(rules: Rules, athlete: Athlete): boolean {
  const who = pick(rules, 'profile.build_for', ['Everyone', 'Advanced only', 'No one'] as const)
  if (who === 'No one') return false
  if (who === 'Everyone') return !isNewLifter(rules, athlete)
  return athlete.trainingAge != null && athlete.trainingAge >= num(rules, 'profile.adv_years')
}

const TAP_WORDS: Record<(typeof TAPS)[number], string> = {
  sleepHours: 'Short on sleep',
  sleepQuality: 'Rough sleep',
  soreness: 'Body is sore',
  stress: 'Stress is high',
  energy: 'Energy is low',
}
const MODIFIER_WORDS: Partial<Record<Flag, string>> = {
  load_jump: 'Training load jumped this week.',
  post_game: 'Day after a game. Keep it controlled.',
  stress_window: 'Busy stretch on the calendar. Keep it controlled.',
  sleep: 'Several short nights in a row.',
  stress: 'Stress has stayed high.',
  soreness: 'Soreness has stayed high.',
  override: 'Coach set today’s zone.',
}

function reason(ci: Checkin, zone: Zone, changedBy: Flag | null, testAdj: number, build: boolean): string {
  if (changedBy) {
    const lead = MODIFIER_WORDS[changedBy]!
    if (changedBy === 'override') return lead
    return zone === 'red' ? `${lead} Technique day.` : `${lead} Volume comes down.`
  }
  if (zone === 'green') return build ? 'Load has been light. Build day: extra work on strength.' : 'You’re ready. Run the plan.'
  const lows = TAPS.filter((t) => ci[t] <= 2)
    .sort((a, b) => ci[a] - ci[b])
    .map((t) => TAP_WORDS[t])
  if (!ci.nutritionHit) lows.push('Missed nutrition yesterday')
  if (testAdj < 0) lows.push('Test is down from baseline')
  const lead = lows.slice(0, 2).join('. ') || 'Trend is down'
  return zone === 'yellow' ? `${lead}. Volume comes down today.` : `${lead}. Technique day. Coach has been flagged.`
}

/** Score one athlete's day. Returns null when there's no check-in for `date`. */
export function scoreDay(rules: Rules, athlete: Athlete, history: History, date: string): ScoreResult | null {
  const byDate = new Map(history.checkins.map((c) => [c.date, c]))
  const ci = byDate.get(date)
  if (!ci) return null

  // 1–3. Readiness, trend, testing
  const r = readiness(rules, ci)
  const prior: number[] = []
  for (let i = 1; i <= 7; i++) {
    const p = byDate.get(addDays(date, -i))
    if (p) prior.push(readiness(rules, p))
  }
  const trend = mean(prior)
  const t = num(rules, 'score.trend_pct')
  const blended = trend == null ? r : ((100 - t) * r + t * trend) / 100
  const testAdj = testAdjustment(rules, athlete, byDate, date)
  const score = Math.round(Math.min(100, Math.max(0, blended + testAdj)))

  // 4. Zone
  let zone: Zone = score >= num(rules, 'score.green_min') ? 'green' : score >= num(rules, 'score.yellow_min') ? 'yellow' : 'red'

  // 6. Modifiers, in order. The first one that lowers the zone leads the reason.
  const flags: Flag[] = []
  const caps: Flag[] = []
  let changedBy: Flag | null = null
  const apply = (flag: Flag, next: Zone) => {
    if (next !== zone) {
      caps.push(flag)
      changedBy ??= flag
      zone = next
    }
  }

  const ac = acRatio(rules, history.dayLoads, date)
  if (ac.ratio != null && ac.ratio > num(rules, 'score.ac_high')) {
    flags.push('load_jump')
    const action = pick(rules, 'score.ac_high_action', ['Drop one zone', 'Cap at Yellow', 'Flag coach only'] as const)
    if (action === 'Drop one zone') apply('load_jump', dropOne(zone))
    if (action === 'Cap at Yellow') apply('load_jump', capAt(zone, 'yellow'))
  }

  if (dayTypeOn(rules, addDays(date, -1)) === 'Game') {
    const cap = pick(rules, 'team.postgame_cap', ['Yellow', 'Red', 'No cap'] as const)
    if (cap !== 'No cap') apply('post_game', capAt(zone, cap === 'Yellow' ? 'yellow' : 'red'))
  }

  if (history.stressWindows.some((w) => w.start <= date && date <= w.end)) {
    if (pick(rules, 'stress.window_cap', ['Cap at Yellow', 'No cap'] as const) === 'Cap at Yellow') {
      apply('stress_window', capAt(zone, 'yellow'))
    }
  }

  const patterns: [Flag, boolean, string][] = [
    [
      'sleep',
      streak(byDate, date, num(rules, 'sleep.flag.nights'), (c) => sleepHoursFor(rules, c.sleepHours) < num(rules, 'sleep.flag.under')),
      'sleep.flag.action',
    ],
    ['stress', streak(byDate, date, num(rules, 'stress.flag.days'), (c) => c.stress <= num(rules, 'stress.flag.level')), 'stress.flag.action'],
    ['soreness', streak(byDate, date, num(rules, 'body.flag.days'), (c) => c.soreness <= num(rules, 'body.flag.level')), 'body.flag.action'],
  ]
  for (const [flag, hit, actionKey] of patterns) {
    if (!hit) continue
    flags.push(flag)
    const action = pick(rules, actionKey, ['Coach conversation', 'Coach check', 'Cap at Yellow', 'Both'] as const)
    if (action === 'Cap at Yellow' || action === 'Both') apply(flag, capAt(zone, 'yellow'))
  }

  // 5. Build day
  const { phase } = phaseOn(rules, date)
  let build =
    zone === 'green' &&
    ac.ratio != null &&
    ac.ratio < num(rules, 'score.ac_low') &&
    pick(rules, 'score.ac_low_action', ['Build day', 'No change'] as const) === 'Build day' &&
    pick(rules, `phase.${phase}.build`, ['Yes', 'No'] as const) === 'Yes' &&
    buildAllowed(rules, athlete)

  // 6. Coach override replaces the zone, keeps the number
  const override = history.overrides.find((o) => o.date === date)
  if (override) {
    flags.push('override')
    if (override.zone !== zone) changedBy = 'override'
    zone = override.zone
    build = build && zone === 'green'
  }

  // 7. Coach flags
  if (zone === 'red') flags.push('red')
  if (zone !== 'green' && dayTypeOn(rules, date) === 'Game') flags.push('game_day_zone')
  if (zone === 'yellow') {
    const past = new Map(history.pastZones.map((p) => [p.date, p.zone]))
    let run = 1
    while (past.get(addDays(date, -run)) === 'yellow') run++
    if (run >= num(rules, 'override.yellow_streak')) flags.push('yellow_streak')
  }
  if (athlete.status !== 'full') flags.push('status')

  return { score, zone, readiness: r, trend, testAdj, ac, flags, caps, build, reason: reason(ci, zone, changedBy, testAdj, build) }
}
