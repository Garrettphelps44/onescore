// TEST-ONLY fixtures (docs/06-vault-check-and-tests.md → Fixtures).
// Decisions come from _reference/field-map.json. The program answers below are
// the Draft's example program, used only so the tests have a facility to run —
// they are never app defaults.
import fieldMap from '../../../_reference/field-map.json'
import type { Athlete, History, Rules } from '../types'

type Option = { label: string; sets: Record<string, string | number> }
type Decision = { key: string; options: Option[] }
const decisions = (fieldMap as unknown as { decisions: Decision[] }).decisions

const week = (mon: string, tue: string, wed: string, thu: string, fri: string, sat: string, sun: string) => ({
  mon, tue, wed, thu, fri, sat, sun,
})

function phase(p: string, start: string, days: Record<string, string>) {
  const out: Record<string, string> = { [`phase.${p}.start`]: start }
  for (const [d, t] of Object.entries(days)) out[`phase.${p}.week.${d}`] = t
  return out
}

/** Sample facility program (Layer 3 answers). 2026-06-01 is a Monday. */
export const program: Rules = {
  'test.weekly.name': 'Vertical jump',
  'test.weekly.day': 'Mon',
  'test.weekly.unit': 'in',
  'test.weekly.better': 'Higher',

  'core4.1.name': '90/90 Hip Switch', 'core4.1.sets': 2, 'core4.1.dose': '6/side', 'core4.1.tag': 'None',
  'core4.2.name': 'Glute Bridge', 'core4.2.sets': 2, 'core4.2.dose': '10', 'core4.2.tag': 'Lower',
  'core4.3.name': 'Walking Lunge + Reach', 'core4.3.sets': 2, 'core4.3.dose': '10 yd', 'core4.3.tag': 'Lower',
  'core4.4.name': 'Pogo Jumps', 'core4.4.sets': 2, 'core4.4.dose': '10', 'core4.4.tag': 'Jump',

  'skill.s1.sport': 'Football',
  'skill.s1.d1.name': 'Stance and start', 'skill.s1.d1.amount': 6, 'skill.s1.d1.unit': 'reps', 'skill.s1.d1.contact': false,
  'skill.s1.d2.name': 'Position footwork', 'skill.s1.d2.amount': 5, 'skill.s1.d2.unit': 'min', 'skill.s1.d2.contact': false,
  'skill.s1.d3.name': 'Ball security and catching', 'skill.s1.d3.amount': 20, 'skill.s1.d3.unit': 'reps', 'skill.s1.d3.contact': true,

  'speed.a.name': '10 yd acceleration', 'speed.a.reps': 6,
  'speed.b.name': 'Flying 20 yd', 'speed.b.reps': 4,
  'speed.c.name': '10 yd acceleration', 'speed.c.reps': 6,
  'speed.practice.name': '10 yd acceleration', 'speed.practice.reps': 4,

  'str.a.anchor': 'Back Squat', 'str.a.anchor_region': 'Lower',
  'str.a.acc1.name': 'Romanian Deadlift', 'str.a.acc1.sets': 3, 'str.a.acc1.reps': '8', 'str.a.acc1.load': '135', 'str.a.acc1.region': 'Lower',
  'str.a.acc2.name': 'DB Split Squat', 'str.a.acc2.sets': 3, 'str.a.acc2.reps': '8', 'str.a.acc2.load': '35', 'str.a.acc2.region': 'Lower',
  'str.a.acc3.name': 'Plank', 'str.a.acc3.sets': 3, 'str.a.acc3.reps': '30s', 'str.a.acc3.load': 'BW', 'str.a.acc3.region': 'Core',
  'str.b.anchor': 'Bench Press', 'str.b.anchor_region': 'Upper',
  'str.b.acc1.name': 'DB Row', 'str.b.acc1.sets': 3, 'str.b.acc1.reps': '10', 'str.b.acc1.load': '55', 'str.b.acc1.region': 'Upper',
  'str.b.acc2.name': 'Chin-up', 'str.b.acc2.sets': 3, 'str.b.acc2.reps': '6', 'str.b.acc2.load': 'BW', 'str.b.acc2.region': 'Upper',
  'str.b.acc3.name': 'Pallof Press', 'str.b.acc3.sets': 3, 'str.b.acc3.reps': '10', 'str.b.acc3.load': 'BW', 'str.b.acc3.region': 'Core',
  'str.c.anchor': 'Trap Bar Deadlift', 'str.c.anchor_region': 'Lower',
  'str.c.acc1.name': 'Single-Leg RDL', 'str.c.acc1.sets': 3, 'str.c.acc1.reps': '8', 'str.c.acc1.load': '40', 'str.c.acc1.region': 'Lower',
  'str.c.acc2.name': 'DB Incline Press', 'str.c.acc2.sets': 3, 'str.c.acc2.reps': '10', 'str.c.acc2.load': '45', 'str.c.acc2.region': 'Upper',
  'str.c.acc3.name': 'Farmer Carry', 'str.c.acc3.sets': 3, 'str.c.acc3.reps': '40 yd', 'str.c.acc3.load': '60', 'str.c.acc3.region': 'Full',

  'cond.a.name': 'Tempo run 100 yd', 'cond.a.amount': 8, 'cond.a.unit': 'reps', 'cond.a.type': 'Run',
  'cond.b.name': 'Bike sprint 15 sec', 'cond.b.amount': 10, 'cond.b.unit': 'reps', 'cond.b.type': 'Bike',
  'cond.c.name': '300 yd shuttle', 'cond.c.amount': 2, 'cond.c.unit': 'reps', 'cond.c.type': 'Run',
  'cond.swap.name': 'Bike sprint 15 sec', 'cond.swap.amount': 10, 'cond.swap.unit': 'reps',

  'team.practice_min': 90,
  'team.game_min': 70,
  'team.practice_letter': 'Next lift day',
  'stress.referral': 'School counselor',

  'avail.lower.action': 'Swap', 'avail.lower.swap': 'Bench Press', 'avail.lower.sets': 3, 'avail.lower.reps': '5',
  'avail.upper.action': 'Remove',
  'avail.sprint.action': 'Remove',
  'avail.jump.action': 'Remove',
  'avail.contact.action': 'Remove',

  ...phase('off', '06/01', week('Lift', 'Practice', 'Lift', 'Off', 'Lift', 'Game', 'Off')),
  ...phase('pre', '08/03', week('Lift', 'Practice', 'Lift', 'Practice', 'Lift', 'Practice', 'Off')),
  ...phase('in', '09/07', week('Lift', 'Practice', 'Lift', 'Practice', 'Game', 'Off', 'Off')),
  ...phase('post', '11/30', week('Lift', 'Off', 'Lift', 'Off', 'Off', 'Off', 'Off')),
}

/** Resolve decisions (by option chooser) + program, like Setup's Finish. */
function resolve(choose: (d: Decision) => Option): Rules {
  const rules: Record<string, string | number | boolean> = {}
  for (const d of decisions) Object.assign(rules, choose(d).sets)
  return { ...rules, ...program }
}

/** Every decision answered with its "(STS)" option. */
export const rulesSTS = resolve((d) => d.options.find((o) => o.label.includes('(STS)'))!)

/** Every decision answered with its first option (the cautious end of each question). */
export const rulesProtect = resolve((d) => d.options[0])

export const athlete: Athlete = {
  sport: 'Football',
  bodyweight: 180,
  trainingAge: 2,
  maxes: { a: 300, b: 200, c: 350 },
  testBaseline: null,
  status: 'full',
  restrictions: [],
}

export const emptyHistory = (): History => ({
  checkins: [],
  dayLoads: [],
  statusChanges: [],
  overrides: [],
  stressWindows: [],
  pastZones: [],
})

/** Check-in with every tap the same value. */
export const taps = (date: string, v: number, nutritionHit = true) => ({
  date,
  sleepHours: v,
  sleepQuality: v,
  soreness: v,
  stress: v,
  energy: v,
  nutritionHit,
})
