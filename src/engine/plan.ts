import { addDays, dayTypeOn, daysBetween, liftLetter, phaseOn, practiceLetter, weekOfPhase } from './dates'
import { nutritionFor } from './nutrition'
import { check, has, num, pick, text } from './rules'
import { isNewLifter } from './score'
import type { Athlete, Block, History, Letter, Phase, PlanItem, PlanResult, Restriction, Rules, ScoreResult, Zone } from './types'

// planDay: zone + rules → today's training and nutrition. Spec: docs/04-plan-engine.md.

/**
 * New lifters on "Core 4 + anchor technique only" do the anchor at this dose.
 * Set by docs/04-plan-engine.md §7, not by a Setup answer yet — see FEATURE-IDEAS.
 */
const NEW_LIFTER_ANCHOR = { sets: 3, reps: 5 }

const RESTRICTION_WORDS: Record<Restriction, string> = {
  lower: 'No lower body',
  upper: 'No upper body',
  sprint: 'No sprinting',
  jump: 'No jumping',
  contact: 'No contact',
}

const round5 = (x: number) => Math.max(0, Math.round(x / 5) * 5)
const atLeast1 = (n: number) => Math.max(1, n)

/** "135" or "135 lb" → 135, so it counts toward tonnage. Anything else stays text. */
function numericOrText(v: string): number | string {
  const m = /^(\d+(?:\.\d+)?)\s*(lb|lbs)?$/i.exec(v.trim())
  return m ? Number(m[1]) : v
}

interface Ctx {
  rules: Rules
  athlete: Athlete
  zone: Zone
  build: boolean
  phase: Phase
  week: number
  transition: boolean
  techniqueOnly: boolean
  returnPct: number | null
}

function core4(c: Ctx): Block {
  const oneSet = c.zone === 'red' && pick(c.rules, 'core4.red', ['Same as written', '1 set each'] as const) === '1 set each'
  const items: PlanItem[] = []
  for (let i = 1; i <= 4; i++) {
    const sets = oneSet ? 1 : num(c.rules, `core4.${i}.sets`)
    const dose = text(c.rules, `core4.${i}.dose`)
    const tag = pick(c.rules, `core4.${i}.tag`, ['None', 'Lower', 'Upper', 'Jump'] as const)
    items.push({ name: text(c.rules, `core4.${i}.name`), sets, dose: `${sets} × ${dose}`, tags: tag === 'None' ? [] : [tag] })
  }
  return { key: 'core4', title: 'Core 4 Movement Prep', items }
}

function sportSkill(c: Ctx, gameDay: boolean): Block | null {
  let slot = 0
  for (let s = 1; s <= 5; s++) {
    if (has(c.rules, `skill.s${s}.sport`) && text(c.rules, `skill.s${s}.sport`).toLowerCase() === c.athlete.sport.trim().toLowerCase()) {
      slot = s
      break
    }
  }
  if (!slot) throw new Error(`No Sport Skill drills in Setup for "${c.athlete.sport}".`)

  let pct = 100
  let prefix = ''
  if (gameDay) pct = num(c.rules, 'skill.game_pct')
  else if (c.zone === 'yellow') pct = num(c.rules, 'skill.yellow_pct')
  else if (c.zone === 'red') {
    if (pick(c.rules, 'skill.red_mode', ['Remove block', 'Technique reps'] as const) === 'Remove block') return null
    pct = num(c.rules, 'skill.red_pct')
    prefix = 'Technique: '
  }

  const items: PlanItem[] = []
  for (let d = 1; d <= 3; d++) {
    const k = `skill.s${slot}.d${d}`
    if (!has(c.rules, `${k}.name`)) continue
    const amount = Math.ceil((num(c.rules, `${k}.amount`) * pct) / 100)
    const unit = text(c.rules, `${k}.unit`)
    items.push({ name: prefix + text(c.rules, `${k}.name`), amount, unit, dose: `${amount} ${unit}`, tags: check(c.rules, `${k}.contact`) ? ['Contact'] : [] })
  }
  return { key: 'skill', title: 'Sport Skill', items, note: gameDay ? 'Primer' : undefined }
}

function speed(c: Ctx, source: Letter | 'practice'): Block | null {
  if (c.techniqueOnly) return null
  let reps = num(c.rules, `speed.${source}.reps`) + num(c.rules, `phase.${c.phase}.speed_add`)
  if (c.zone === 'yellow') reps = Math.max(num(c.rules, 'speed.min_reps'), reps - num(c.rules, 'speed.yellow_minus'))
  if (c.zone === 'red') {
    const mode = pick(c.rules, 'speed.red', ['Remove', 'Half reps', 'Same'] as const)
    if (mode === 'Remove') return null
    if (mode === 'Half reps') reps = Math.ceil(reps / 2)
  }
  if (reps <= 0) return null
  return { key: 'speed', title: 'Speed', items: [{ name: text(c.rules, `speed.${source}.name`), reps, dose: `${reps} reps` }] }
}

/** The Anchor Method. `reduced` = practice-day light lift (Yellow strength rules). */
function strength(c: Ctx, letter: Letter, reduced: boolean): Block | null {
  const r = c.rules
  const zone: Zone = reduced && c.zone === 'green' ? 'yellow' : c.zone
  const region = pick(r, `str.${letter}.anchor_region`, ['Lower', 'Upper', 'Full'] as const)
  const name = text(r, `str.${letter}.anchor`)
  const max = c.athlete.maxes[letter]

  if (c.techniqueOnly) {
    const { sets, reps } = NEW_LIFTER_ANCHOR
    return { key: 'strength', title: 'Strength', items: [{ name, sets, reps, load: 'Technique weight', anchor: true, dose: `${sets} × ${reps}`, tags: [region] }] }
  }

  // Dose for the phase
  let sets: number, reps: number, pct: number
  if (c.phase === 'off') {
    const row = Math.min(5, Math.ceil(c.week / 4))
    sets = num(r, `str.block.${row}.sets`)
    reps = num(r, `str.block.${row}.reps`)
    pct = num(r, `str.block.${row}.pct`)
  } else {
    sets = num(r, `phase.${c.phase}.anchor_sets`)
    reps = num(r, `phase.${c.phase}.anchor_reps`)
    pct = num(r, `phase.${c.phase}.anchor_pct`)
  }
  if (sets <= 0) return null
  const setAdj = (c.transition ? -1 : 0) + (zone === 'yellow' ? num(r, 'str.yellow.anchor_sets') : 0) + (zone === 'green' && c.build ? num(r, 'str.build_sets') : 0)
  let loadPct = pct
  if (zone === 'red') {
    sets = num(r, 'str.red.sets')
    reps = num(r, 'str.red.reps')
    loadPct = num(r, 'str.red.pct')
  } else {
    sets = atLeast1(sets + setAdj)
    if (zone === 'yellow') loadPct = (pct * num(r, 'str.yellow.load_pct')) / 100
  }
  if (c.returnPct != null) loadPct = Math.min(loadPct, c.returnPct)

  const standardAtTechnique = isNewLifter(r, c.athlete) // only reached when new_plan = standard at technique loads
  let load: number | string
  if (standardAtTechnique) load = 'Technique weight'
  else if (max != null && max > 0) load = round5((max * loadPct) / 100)
  else load = pick(r, 'profile.no_max', ['Technique weights', 'Coach sets load'] as const) === 'Technique weights' ? 'Technique weight' : 'Coach sets load'

  const items: PlanItem[] = [{ name, sets, reps, load, anchor: true, dose: `${sets} × ${reps}`, tags: [region] }]

  // Accessories
  const redAcc = zone === 'red' ? pick(r, 'str.red.acc', ['Remove', '1 set each', 'Same'] as const) : null
  if (redAcc !== 'Remove') {
    for (let n = 1; n <= 3; n++) {
      const k = `str.${letter}.acc${n}`
      if (!has(r, `${k}.name`)) continue
      let s = c.phase === 'off' ? num(r, `${k}.sets`) : num(r, `phase.${c.phase}.acc_sets`)
      if (s <= 0) continue
      if (redAcc === '1 set each') s = 1
      else if (zone !== 'red') {
        s += (c.transition ? -1 : 0) + (zone === 'yellow' ? num(r, 'str.yellow.acc_sets') : 0) + (zone === 'green' && c.build ? num(r, 'str.build_sets') : 0)
        s = atLeast1(s)
      }
      const accReps = numericOrText(text(r, `${k}.reps`))
      items.push({
        name: text(r, `${k}.name`),
        sets: s,
        reps: accReps,
        load: numericOrText(text(r, `${k}.load`)),
        dose: `${s} × ${accReps}`,
        tags: [pick(r, `${k}.region`, ['Lower', 'Upper', 'Core', 'Full'] as const)],
      })
    }
  }
  return { key: 'strength', title: 'Strength', items }
}

/** Conditioning plus the multiplier used, so a restriction swap scales the same way. */
function conditioning(c: Ctx, letter: Letter, extraFactor: number): { block: Block; factor: number } | null {
  if (c.techniqueOnly || extraFactor <= 0) return null
  let factor = (num(c.rules, `phase.${c.phase}.cond_pct`) / 100) * extraFactor
  if (c.zone === 'yellow') factor *= num(c.rules, 'cond.yellow_pct') / 100
  if (c.zone === 'red') factor *= pick(c.rules, 'cond.red', ['None', 'Half'] as const) === 'Half' ? 0.5 : 0
  if (factor <= 0) return null
  const k = `cond.${letter}`
  const amount = Math.ceil(num(c.rules, `${k}.amount`) * factor)
  const unit = text(c.rules, `${k}.unit`)
  const type = pick(c.rules, `${k}.type`, ['Run', 'Bike', 'Other'] as const)
  return { block: { key: 'cond', title: 'Conditioning', items: [{ name: text(c.rules, `${k}.name`), amount, unit, dose: `${amount} ${unit}`, tags: [type] }] }, factor }
}

/** Half / Full / None → multiplier. */
const HALF_FULL: Record<string, number> = { None: 0, Half: 0.5, Full: 1 }

function returnPct(rules: Rules, athlete: Athlete, history: History, date: string): number | null {
  if (athlete.status === 'out') return null
  const changes = history.statusChanges.filter((s) => s.date <= date).sort((a, b) => a.date.localeCompare(b.date))
  let returnedOn: string | null = null
  for (let i = 1; i < changes.length; i++) {
    if (changes[i - 1].status === 'out' && changes[i].status !== 'out') returnedOn = changes[i].date
    if (changes[i].status === 'out') returnedOn = null
  }
  if (!returnedOn) return null
  const weeks = Math.floor(daysBetween(returnedOn, date) / 7)
  return num(rules, 'avail.rtt.start_pct') + num(rules, 'avail.rtt.step_pct') * weeks
}

/** Section 9: Modified athletes lose (or swap) the work their restrictions rule out. */
function applyRestrictions(c: Ctx, blocks: Block[], condFactor: number | null): Block[] {
  let out = blocks.map((b) => ({ ...b, items: [...b.items] }))
  const drop = (key: Block['key'], hit: (i: PlanItem) => boolean) => {
    for (const b of out) if (b.key === key) b.items = b.items.filter((i) => !hit(i))
  }
  const tagged = (...tags: string[]) => (i: PlanItem) => (i.tags ?? []).some((t) => tags.includes(t))
  let swapRun = false

  for (const res of c.athlete.restrictions) {
    const action = pick(c.rules, `avail.${res}.action`, ['Remove', 'Swap'] as const)
    const regions = res === 'lower' ? ['Lower', 'Full'] : res === 'upper' ? ['Upper', 'Full'] : []
    if (regions.length) {
      for (const b of out) {
        if (b.key !== 'strength') continue
        b.items = b.items.flatMap((i) => {
          if (!tagged(...regions)(i)) return [i]
          if (!i.anchor || action === 'Remove') return []
          const sets = num(c.rules, `avail.${res}.sets`)
          const reps = numericOrText(text(c.rules, `avail.${res}.reps`))
          return [{ name: text(c.rules, `avail.${res}.swap`), sets, reps, load: 'Coach sets load', dose: `${sets} × ${reps}`, tags: [] }]
        })
      }
    }
    if (res === 'lower') drop('core4', tagged('Lower', 'Jump'))
    if (res === 'upper') drop('core4', tagged('Upper'))
    if (res === 'jump') drop('core4', tagged('Jump'))
    if (res === 'contact') drop('skill', tagged('Contact'))
    if (res === 'lower' || res === 'sprint') {
      out = out.filter((b) => b.key !== 'speed')
      swapRun = true
    }
  }

  if (swapRun && condFactor != null) {
    for (const b of out) {
      if (b.key !== 'cond' || !tagged('Run')(b.items[0])) continue
      const amount = Math.ceil(num(c.rules, 'cond.swap.amount') * condFactor)
      const unit = text(c.rules, 'cond.swap.unit')
      b.items = [{ name: text(c.rules, 'cond.swap.name'), amount, unit, dose: `${amount} ${unit}`, tags: ['Bike'] }]
    }
  }
  return out.filter((b) => b.items.length || b.note)
}

export function planDay(rules: Rules, athlete: Athlete, score: ScoreResult, history: History, date: string): PlanResult {
  const { phase } = phaseOn(rules, date)
  const dayType = dayTypeOn(rules, date)
  const week = weekOfPhase(rules, date)
  const newLifter = isNewLifter(rules, athlete)
  const newPlan = pick(rules, 'profile.new_plan', ['Core 4 + anchor technique only', 'Standard plan at technique loads'] as const)
  const c: Ctx = {
    rules,
    athlete,
    zone: score.zone,
    build: score.build,
    phase,
    week,
    transition: week === 1 && pick(rules, 'phase.transition', ['One step lower in volume', 'No change'] as const) === 'One step lower in volume',
    techniqueOnly: newLifter && newPlan === 'Core 4 + anchor technique only',
    returnPct: returnPct(rules, athlete, history, date),
  }
  const nutrition = nutritionFor(rules, athlete.bodyweight, dayType, score.zone)
  const letter = dayType === 'Lift' ? liftLetter(rules, date) : null
  const statusLine =
    athlete.status === 'out'
      ? 'Out'
      : athlete.status === 'modified' && athlete.restrictions.length
        ? `Modified: ${athlete.restrictions.map((x) => RESTRICTION_WORDS[x]).join(', ')}`
        : athlete.status === 'modified'
          ? 'Modified'
          : null
  const result = (blocks: Block[]): PlanResult => ({ dayType, phase, weekOfPhase: week, letter, blocks, nutrition, statusLine })

  if (dayType === 'Off') return result([])

  // Status first: Out
  if (athlete.status === 'out') {
    const plan = pick(rules, 'avail.out_plan', ['Core 4 + rehab', 'Rehab only', 'Core 4 only'] as const)
    const blocks: Block[] = []
    if (plan !== 'Rehab only') blocks.push(core4(c))
    if (plan !== 'Core 4 only') blocks.push({ key: 'rehab', title: 'Rehab', items: [], note: 'Follow your athletic trainer’s plan today.' })
    return result(blocks)
  }

  const blocks: Block[] = []
  let condFactor: number | null = null
  const addOrdered = (skill: Block | null, spd: Block | null) => {
    const skillFirst = pick(rules, 'skill.order', ['Skill, then speed', 'Speed, then skill'] as const) === 'Skill, then speed'
    for (const b of skillFirst ? [skill, spd] : [spd, skill]) if (b) blocks.push(b)
  }
  const addCond = (l: Letter, factor: number) => {
    const cond = conditioning(c, l, factor)
    if (cond) {
      blocks.push(cond.block)
      condFactor = cond.factor
    }
  }
  const pregameFactor = () =>
    dayTypeOn(rules, addDays(date, 1)) === 'Game' ? HALF_FULL[pick(rules, 'cond.pregame', ['None', 'Half', 'Full'] as const)] : 1

  if (dayType === 'Game') {
    const gd = pick(rules, 'team.gameday', ['Core 4 + skill primer', 'Core 4 only', 'Nothing'] as const)
    if (gd !== 'Nothing') blocks.push(core4(c))
    if (gd === 'Core 4 + skill primer') {
      const skill = sportSkill(c, true)
      if (skill) blocks.push(skill)
    }
    blocks.push({ key: 'game', title: 'Game', items: [], note: 'Play. Log minutes and RPE after.' })
  } else if (dayType === 'Practice') {
    blocks.push(core4(c))
    const practiceSpeed = pick(rules, 'team.practice_speed', ['None', 'Practice-day drill'] as const) === 'Practice-day drill'
    addOrdered(sportSkill(c, false), practiceSpeed ? speed(c, 'practice') : null)
    const reduced = pick(rules, 'team.practice_strength', ['None', 'Reduced'] as const) === 'Reduced'
    const practiceCond = HALF_FULL[pick(rules, 'cond.practice', ['None', 'Half', 'Full'] as const)]
    if (reduced || practiceCond > 0) {
      const pl = practiceLetter(rules, date)
      if (reduced) {
        const s = strength(c, pl, true)
        if (s) blocks.push(s)
      }
      addCond(pl, practiceCond * pregameFactor())
    }
    blocks.push({ key: 'practice', title: 'Team Practice', items: [], note: 'Log practice minutes and RPE after.' })
  } else {
    const l = letter!
    blocks.push(core4(c))
    addOrdered(sportSkill(c, false), speed(c, l))
    const s = strength(c, l, false)
    if (s) blocks.push(s)
    addCond(l, pregameFactor())
  }

  const final = athlete.status === 'modified' ? applyRestrictions(c, blocks, condFactor) : blocks
  return result(final)
}
