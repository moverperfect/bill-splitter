import { minorFactor } from './currency'
import { evaluate } from './expr'
import type { AdjustmentLine, Bill, Id, ItemLine, Line } from './types'

export type LineIssue = 'add-cost' | 'check-cost' | 'assign-people' | 'add-amount' | 'check-amount' | 'nothing-to-split'

export type BillStatus =
  | 'add-items'
  | 'check-lines'
  | 'pick-payer'
  | 'check-total'
  | 'add-rate'
  | 'add-charged'
  | 'check-rate'
  | 'balanced'

export interface LineResult {
  /** Signed amount in the bill's currency; null when the line has an issue or is blank. */
  amount: number | null
  shares: Record<Id, number>
  issue: LineIssue | null
}

export interface BillResult {
  lines: Record<Id, LineResult>
  itemSubtotal: number
  /** Total in the bill's currency. */
  total: number
  localShares: Record<Id, number>
  /** Local units per 1 home unit, when known. */
  rate: number | null
  /** Home currency total and shares in minor units (pence, cents), when the bill is balanced. */
  homeTotalMinor: number | null
  homeSharesMinor: Record<Id, number> | null
  status: BillStatus
}

export function computeBill(bill: Bill, homeCurrency: string): BillResult {
  const participants = bill.participantIds
  const lines: Record<Id, LineResult> = {}
  const itemShares = zeroes(participants)
  let itemSubtotal = 0
  let counted = 0

  for (const line of bill.lines) {
    if (line.kind !== 'item') continue
    if (isBlank(line)) {
      lines[line.id] = { amount: null, shares: {}, issue: null }
      continue
    }
    counted++
    const result = splitItem(line, participants)
    lines[line.id] = result
    if (result.amount !== null) {
      itemSubtotal += result.amount
      addInto(itemShares, result.shares)
    }
  }

  const localShares = { ...itemShares }
  let total = itemSubtotal
  for (const line of bill.lines) {
    if (line.kind !== 'adjustment') continue
    if (isBlank(line)) {
      lines[line.id] = { amount: null, shares: {}, issue: null }
      continue
    }
    counted++
    const result = splitAdjustment(line, participants, itemShares, itemSubtotal)
    lines[line.id] = result
    if (result.amount !== null) {
      total += result.amount
      addInto(localShares, result.shares)
    }
  }

  const base = { lines, itemSubtotal, total, localShares }
  const hasIssue = Object.values(lines).some((l) => l.issue !== null)

  if (counted === 0) return unbalanced(base, 'add-items')
  if (hasIssue) return unbalanced(base, 'check-lines')
  if (!bill.payerId || !participants.includes(bill.payerId)) return unbalanced(base, 'pick-payer')
  if (total <= 0) return unbalanced(base, 'check-total')

  let rate: number
  let homeTotal: number
  if (bill.payment.type === 'cash') {
    const parsed = evaluate(bill.payment.rate)
    if (parsed.kind === 'empty') return unbalanced(base, 'add-rate')
    if (parsed.kind === 'invalid' || parsed.value <= 0) return unbalanced(base, 'check-rate')
    rate = parsed.value
    homeTotal = total / rate
  } else {
    const parsed = evaluate(bill.payment.charged)
    if (parsed.kind === 'empty') return unbalanced(base, 'add-charged')
    if (parsed.kind === 'invalid' || parsed.value <= 0) return unbalanced(base, 'check-rate')
    homeTotal = parsed.value
    rate = total / homeTotal
  }

  const homeTotalMinor = Math.round(homeTotal * minorFactor(homeCurrency))
  return {
    ...base,
    rate,
    homeTotalMinor,
    homeSharesMinor: allocate(homeTotalMinor, participants, localShares, total),
    status: 'balanced',
  }
}

function splitItem(line: ItemLine, participants: Id[]): LineResult {
  const cost = evaluate(line.cost)
  if (cost.kind === 'empty') return issue('add-cost')
  if (cost.kind === 'invalid' || cost.value < 0) return issue('check-cost')

  const weights = participants.map((id) => [id, Math.max(0, line.weights[id] ?? 0)] as const)
  const units = weights.reduce((sum, [, w]) => sum + w, 0)
  if (units <= 0) return issue('assign-people')

  const shares: Record<Id, number> = {}
  for (const [id, w] of weights) if (w > 0) shares[id] = (cost.value * w) / units
  return { amount: cost.value, shares, issue: null }
}

function splitAdjustment(
  line: AdjustmentLine,
  participants: Id[],
  itemShares: Record<Id, number>,
  itemSubtotal: number,
): LineResult {
  const value = evaluate(line.value)
  if (value.kind === 'empty') return issue('add-amount')
  if (value.kind === 'invalid' || value.value < 0) return issue('check-amount')

  const magnitude = line.mode === 'percent' ? (itemSubtotal * value.value) / 100 : value.value
  const amount = line.direction === 'subtract' ? -magnitude : magnitude

  const shares: Record<Id, number> = {}
  if (line.split === 'equal') {
    if (participants.length === 0) return issue('assign-people')
    for (const id of participants) shares[id] = amount / participants.length
  } else {
    if (itemSubtotal <= 0) return issue('nothing-to-split')
    for (const id of participants) {
      const own = itemShares[id] ?? 0
      if (own !== 0) shares[id] = (amount * own) / itemSubtotal
    }
  }
  return { amount, shares, issue: null }
}

/**
 * Splits a total in minor units in proportion to the given shares using the
 * largest-remainder method, so the parts always add up exactly to the total.
 * Ties go to whoever comes first in `order`.
 */
export function allocate(totalMinor: number, order: Id[], shares: Record<Id, number>, sharesTotal: number): Record<Id, number> {
  const parts = order.map((id, index) => {
    // Round away float noise so 1234.9999999 doesn't floor to 1234.
    const exact = Number((((shares[id] ?? 0) / sharesTotal) * totalMinor).toFixed(6))
    const floor = Math.floor(exact)
    return { id, index, floor, remainder: exact - floor }
  })
  let leftover = totalMinor - parts.reduce((sum, p) => sum + p.floor, 0)
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (const part of byRemainder) {
    if (leftover <= 0) break
    part.floor++
    leftover--
  }
  return Object.fromEntries(parts.map((p) => [p.id, p.floor]))
}

function isBlank(line: Line): boolean {
  if (line.kind === 'item') {
    return line.name.trim() === '' && line.cost.trim() === '' && !Object.values(line.weights).some((w) => w > 0)
  }
  return line.name.trim() === '' && line.value.trim() === ''
}

function issue(kind: LineIssue): LineResult {
  return { amount: null, shares: {}, issue: kind }
}

function zeroes(ids: Id[]): Record<Id, number> {
  return Object.fromEntries(ids.map((id) => [id, 0]))
}

function addInto(target: Record<Id, number>, source: Record<Id, number>) {
  for (const [id, value] of Object.entries(source)) target[id] = (target[id] ?? 0) + value
}

function unbalanced(base: Pick<BillResult, 'lines' | 'itemSubtotal' | 'total' | 'localShares'>, status: BillStatus): BillResult {
  return { ...base, rate: null, homeTotalMinor: null, homeSharesMinor: null, status }
}

/** Whether the shares now differ from what was entered in Splitwise. */
export function changedSinceEntered(bill: Bill, result: BillResult): boolean {
  const entered = bill.entered
  if (!entered) return false
  if (result.homeTotalMinor !== entered.totalMinor || !result.homeSharesMinor) return true
  const ids = new Set([...Object.keys(entered.sharesMinor), ...Object.keys(result.homeSharesMinor)])
  for (const id of ids) {
    if ((entered.sharesMinor[id] ?? 0) !== (result.homeSharesMinor[id] ?? 0)) return true
  }
  return false
}
