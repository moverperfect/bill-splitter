import { formatMinor } from './format'
import { computeBill } from './split'
import type { Bill, Id, Trip } from './types'

export interface PersonBalance {
  id: Id
  /** Home currency paid for the group, in minor units. */
  paidMinor: number
  /** Home currency share of the bills, in minor units. */
  shareMinor: number
  /** paid − share: positive gets money back, negative owes. */
  netMinor: number
}

export interface Transfer {
  from: Id
  to: Id
  amountMinor: number
}

export interface TripBalances {
  people: PersonBalance[]
  transfers: Transfer[]
  /** Bills that aren't balanced yet, so aren't counted. */
  pending: Bill[]
  countedBills: number
}

export function tripBalances(trip: Trip): TripBalances {
  const totals = new Map<Id, { paid: number; share: number }>()
  const entry = (id: Id) => {
    let t = totals.get(id)
    if (!t) totals.set(id, (t = { paid: 0, share: 0 }))
    return t
  }
  for (const person of trip.people) entry(person.id)

  const pending: Bill[] = []
  let countedBills = 0
  for (const bill of trip.bills) {
    const result = computeBill(bill, trip.homeCurrency)
    if (result.homeTotalMinor === null || !result.homeSharesMinor || !bill.payerId) {
      if (bill.lines.length > 0) pending.push(bill)
      continue
    }
    countedBills++
    entry(bill.payerId).paid += result.homeTotalMinor
    for (const [id, share] of Object.entries(result.homeSharesMinor)) entry(id).share += share
  }

  const people = [...totals].map(([id, t]) => ({ id, paidMinor: t.paid, shareMinor: t.share, netMinor: t.paid - t.share }))
  return { people, transfers: settle(people), pending, countedBills }
}

/**
 * Suggests who pays whom so everyone ends up even. Greedily matches the biggest
 * debtor with the biggest creditor, which needs at most n − 1 payments.
 */
export function settle(balances: Pick<PersonBalance, 'id' | 'netMinor'>[]): Transfer[] {
  const creditors = balances.filter((b) => b.netMinor > 0).map((b) => ({ id: b.id, left: b.netMinor }))
  const debtors = balances.filter((b) => b.netMinor < 0).map((b) => ({ id: b.id, left: -b.netMinor }))
  const transfers: Transfer[] = []

  while (creditors.length > 0 && debtors.length > 0) {
    creditors.sort((a, b) => b.left - a.left)
    debtors.sort((a, b) => b.left - a.left)
    const creditor = creditors[0]!
    const debtor = debtors[0]!
    const amount = Math.min(creditor.left, debtor.left)
    transfers.push({ from: debtor.id, to: creditor.id, amountMinor: amount })
    creditor.left -= amount
    debtor.left -= amount
    if (creditor.left === 0) creditors.shift()
    if (debtor.left === 0) debtors.shift()
  }
  return transfers
}

/** Plain-text summary for the share sheet (WhatsApp, Messages, …). */
export function balancesText(trip: Trip, balances: TripBalances): string {
  const name = (id: Id) => trip.people.find((p) => p.id === id)?.name ?? 'Removed person'
  const money = (minor: number) => formatMinor(minor, trip.homeCurrency)
  const lines = [`${trip.name || 'Trip'} — ${balances.countedBills} bill${balances.countedBills === 1 ? '' : 's'}`, '']
  for (const p of balances.people) {
    if (p.paidMinor === 0 && p.shareMinor === 0) continue
    lines.push(`${name(p.id)}: paid ${money(p.paidMinor)}, share ${money(p.shareMinor)}`)
  }
  lines.push('')
  if (balances.transfers.length === 0) lines.push('Everyone is even.')
  else {
    lines.push('To settle up:')
    for (const t of balances.transfers) lines.push(`• ${name(t.from)} pays ${name(t.to)} ${money(t.amountMinor)}`)
  }
  if (balances.pending.length > 0) {
    lines.push('', `(${balances.pending.length} unfinished bill${balances.pending.length === 1 ? '' : 's'} not included)`)
  }
  return lines.join('\n')
}
