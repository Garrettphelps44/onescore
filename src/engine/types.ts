// Shapes the engine reads and returns. Pure data — no database, no UI.
// Dates are the tenant's local date as 'YYYY-MM-DD'.

/** Resolved Setup answers: rule key → value (see docs/02-rules-contract.md). */
export type Rules = Readonly<Record<string, string | number | boolean>>

export type Zone = 'green' | 'yellow' | 'red'
export type DayType = 'Lift' | 'Practice' | 'Game' | 'Off'
export type Phase = 'off' | 'pre' | 'in' | 'post'
export type Letter = 'a' | 'b' | 'c'
export type Status = 'full' | 'modified' | 'out'
export type Restriction = 'lower' | 'upper' | 'sprint' | 'jump' | 'contact'

export interface Athlete {
  sport: string
  bodyweight: number | null
  trainingAge: number | null
  maxes: Record<Letter, number | null>
  testBaseline: number | null
  status: Status
  restrictions: Restriction[]
}

/** One morning check-in. Taps are 1–5, 5 = best. */
export interface Checkin {
  date: string
  sleepHours: number
  sleepQuality: number
  soreness: number
  stress: number
  energy: number
  nutritionHit: boolean
  testValue?: number | null
}

export interface History {
  /** Check-ins on or before the scored date (today's included). */
  checkins: Checkin[]
  /** Total training load per day. Days not listed count as 0. */
  dayLoads: { date: string; load: number }[]
  /** Status changes, any order. */
  statusChanges: { date: string; status: Status }[]
  /** Coach zone overrides. */
  overrides: { date: string; zone: Zone }[]
  /** Coach-set stress windows, inclusive. */
  stressWindows: { start: string; end: string }[]
  /** Final zones of earlier days (from saved daily results), for streak flags. */
  pastZones: { date: string; zone: Zone }[]
}

export type Flag =
  | 'red'
  | 'yellow_streak'
  | 'load_jump'
  | 'post_game'
  | 'stress_window'
  | 'sleep'
  | 'stress'
  | 'soreness'
  | 'game_day_zone'
  | 'override'
  | 'status'

export interface ScoreResult {
  score: number
  zone: Zone
  readiness: number
  /** Mean readiness of the prior days in the trend window, or null if none. */
  trend: number | null
  testAdj: number
  ac: { acute: number; chronic: number; ratio: number | null }
  flags: Flag[]
  caps: Flag[]
  build: boolean
  reason: string
}

export interface PlanItem {
  name: string
  sets?: number
  reps?: number | string
  amount?: number
  unit?: string
  /** Number in lb, or a label such as "Technique weight". */
  load?: number | string
  anchor?: boolean
  /** Display dose, e.g. "3 × 5" or "10 yd". */
  dose?: string
  /** Region / tag / type labels restrictions act on (Lower, Upper, Jump, Contact, Run…). */
  tags?: string[]
}

export interface Block {
  key: 'core4' | 'skill' | 'speed' | 'strength' | 'cond' | 'practice' | 'game' | 'rehab'
  title: string
  items: PlanItem[]
  note?: string
}

export interface Nutrition {
  targets: { calories: number; protein: number; carbs: number; fat: number } | null
  note: string | null
}

export interface PlanResult {
  dayType: DayType
  phase: Phase
  weekOfPhase: number
  letter: Letter | null
  blocks: Block[]
  nutrition: Nutrition
  statusLine: string | null
}
