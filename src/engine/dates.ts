import { pick, text, RuleError } from './rules'
import type { DayType, Letter, Phase, Rules } from './types'

// Dates are plain 'YYYY-MM-DD' strings. Math runs in UTC so no timezone
// can shift a day; the caller already converted to the tenant's local date.

const DAY_MS = 86_400_000
const WEEK_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export const PHASES: readonly Phase[] = ['off', 'pre', 'in', 'post']
const LETTERS: readonly Letter[] = ['a', 'b', 'c']
const DAY_TYPES: readonly DayType[] = ['Lift', 'Practice', 'Game', 'Off']

const toMs = (d: string) => Date.parse(d + 'T00:00:00Z')
const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10)

export const addDays = (d: string, n: number) => fromMs(toMs(d) + n * DAY_MS)
export const daysBetween = (from: string, to: string) => Math.round((toMs(to) - toMs(from)) / DAY_MS)
/** 0 = Sunday … 6 = Saturday. */
export const weekday = (d: string) => new Date(toMs(d)).getUTCDay()
/** 'Mon' … 'Sun', matching `test.weekly.day`. */
export const weekdayShort = (d: string) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekday(d)]

/** Most recent occurrence of MM/DD on or before `date`. */
function lastStart(rules: Rules, phase: Phase, date: string): string {
  const key = `phase.${phase}.start`
  const m = /^(\d{1,2})\/(\d{1,2})$/.exec(text(rules, key))
  if (!m) throw new RuleError(key, 'must be a date written MM/DD')
  const year = Number(date.slice(0, 4))
  const mmdd = `${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
  const thisYear = `${year}-${mmdd}`
  return thisYear <= date ? thisYear : `${year - 1}-${mmdd}`
}

/** The phase whose start is the most recent on or before `date` (wraps across the year). */
export function phaseOn(rules: Rules, date: string): { phase: Phase; start: string } {
  let best: { phase: Phase; start: string } | null = null
  for (const phase of PHASES) {
    const start = lastStart(rules, phase, date)
    if (!best || start > best.start) best = { phase, start }
  }
  return best!
}

export function dayTypeOn(rules: Rules, date: string): DayType {
  const { phase } = phaseOn(rules, date)
  return pick(rules, `phase.${phase}.week.${WEEK_KEYS[weekday(date)]}`, DAY_TYPES)
}

export function weekOfPhase(rules: Rules, date: string): number {
  return Math.floor(daysBetween(phaseOn(rules, date).start, date) / 7) + 1
}

/** Mon-start week. Count Lift days earlier in the week: 0 → A, 1 → B, 2 → C, 4th+ wraps. */
export function liftLetter(rules: Rules, date: string): Letter {
  const sinceMonday = (weekday(date) + 6) % 7
  let n = 0
  for (let i = sinceMonday; i > 0; i--) if (dayTypeOn(rules, addDays(date, -i)) === 'Lift') n++
  return LETTERS[n % LETTERS.length]
}

/** Letter a practice day borrows for a Reduced lift or practice conditioning. */
export function practiceLetter(rules: Rules, date: string): Letter {
  const choice = pick(rules, 'team.practice_letter', ['Day A', 'Next lift day'] as const)
  if (choice === 'Day A') return 'a'
  for (let i = 1; i <= 7; i++) {
    const d = addDays(date, i)
    if (dayTypeOn(rules, d) === 'Lift') return liftLetter(rules, d)
  }
  return 'a' // no Lift days in the week template → next week's first lift would be A
}
