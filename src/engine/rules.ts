import type { Rules } from './types'

// Every rule read goes through here. A missing or malformed rule throws —
// the engine never fills a gap with a default (CLAUDE.md: nothing hard-coded).

export class RuleError extends Error {
  readonly key: string
  constructor(key: string, problem: string) {
    super(`Rule "${key}" ${problem}. Check the facility's Setup answers.`)
    this.name = 'RuleError'
    this.key = key
  }
}

export function has(rules: Rules, key: string): boolean {
  const v = rules[key]
  return v !== undefined && v !== ''
}

export function num(rules: Rules, key: string): number {
  const v = rules[key]
  if (v === undefined || v === '') throw new RuleError(key, 'is missing')
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) throw new RuleError(key, `is not a number ('${String(v)}')`)
  return n
}

export function text(rules: Rules, key: string): string {
  const v = rules[key]
  if (v === undefined || v === '') throw new RuleError(key, 'is missing')
  return String(v).trim()
}

/** A choice rule. Throws if the value isn't one of the options the engine understands. */
export function pick<T extends string>(rules: Rules, key: string, options: readonly T[]): T {
  const v = text(rules, key)
  if (!(options as readonly string[]).includes(v)) {
    throw new RuleError(key, `has an unknown answer ('${v}'); expected one of: ${options.join(', ')}`)
  }
  return v as T
}

export function check(rules: Rules, key: string): boolean {
  return rules[key] === true
}
