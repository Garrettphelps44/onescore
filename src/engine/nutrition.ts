import { num, pick } from './rules'
import type { DayType, Nutrition, Rules, Zone } from './types'

// Spec: docs/04-plan-engine.md §10.

const CAL_KEY: Record<DayType, string> = {
  Off: 'nutr.cal.off',
  Lift: 'nutr.cal.lift',
  Practice: 'nutr.cal.practice',
  Game: 'nutr.cal.game',
}
const NOTE: Record<string, string | null> = {
  Same: null,
  'Same, protein first': 'Protein first today.',
  'Same, no deficit': 'No calorie deficit today.',
}

export function nutritionFor(rules: Rules, bodyweight: number | null, dayType: DayType, zone: Zone): Nutrition {
  let note: string | null = null
  if (zone === 'yellow') note = NOTE[pick(rules, 'nutr.yellow', ['Same', 'Same, protein first'] as const)]
  if (zone === 'red') note = NOTE[pick(rules, 'nutr.red', ['Same', 'Same, no deficit'] as const)]
  if (bodyweight == null || bodyweight <= 0) {
    return { targets: null, note: 'Ask your coach to add your bodyweight.' }
  }
  const calories = Math.round((bodyweight * num(rules, CAL_KEY[dayType])) / 10) * 10
  const protein = Math.round(bodyweight * num(rules, 'nutr.protein'))
  const fat = Math.round(bodyweight * num(rules, 'nutr.fat'))
  const carbs = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4))
  return { targets: { calories, protein, carbs, fat }, note }
}
