import { addDays } from './dates'
import { num, pick } from './rules'
import type { Block, Rules } from './types'

/** Σ sets × reps × load over the prescribed strength items with numeric reps and load. */
export function tonnage(blocks: Block[]): number {
  let t = 0
  for (const b of blocks) {
    if (b.key !== 'strength') continue
    for (const i of b.items) {
      if (typeof i.sets === 'number' && typeof i.reps === 'number' && typeof i.load === 'number') {
        t += i.sets * i.reps * i.load
      }
    }
  }
  return t
}

/** Training session load: (tonnage ÷ divisor + minutes) × RPE. */
export function sessionLoad(rules: Rules, tonnageLb: number, minutes: number, rpe: number): number {
  return (tonnageLb / num(rules, 'score.tonnage_divisor') + minutes) * rpe
}

/**
 * Practice or game load: minutes × athlete RPE, or minutes × the coach's
 * intensity tag, per `team.load_method`.
 */
export function teamLoad(
  rules: Rules,
  minutes: number,
  athleteRpe: number | null,
  coachIntensity: number | null,
): number {
  const method = pick(rules, 'team.load_method', ['Athlete RPE x minutes', 'Coach intensity tag x minutes'] as const)
  const factor = method === 'Athlete RPE x minutes' ? athleteRpe : coachIntensity
  if (factor == null) {
    throw new Error(
      method === 'Athlete RPE x minutes'
        ? 'Practice or game load needs the athlete RPE.'
        : 'Practice or game load needs the coach intensity for this team and day.',
    )
  }
  return minutes * factor
}

/** Acute and chronic average load over the days before `date`. Missing days count as 0. */
export function acRatio(rules: Rules, dayLoads: { date: string; load: number }[], date: string) {
  const acuteDays = num(rules, 'score.acute_days')
  const chronicDays = num(rules, 'score.chronic_days')
  const byDate = new Map<string, number>()
  for (const d of dayLoads) byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.load)
  const sum = (days: number) => {
    let s = 0
    for (let i = 1; i <= days; i++) s += byDate.get(addDays(date, -i)) ?? 0
    return s
  }
  const acute = sum(acuteDays) / acuteDays
  const chronic = sum(chronicDays) / chronicDays
  return { acute, chronic, ratio: chronic > 0 ? acute / chronic : null }
}
