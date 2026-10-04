import { describe, expect, it } from 'vitest'
import { demoTrip } from '../demo'
import { settle, tripBalances } from './balances'
import { computeBill } from './split'

describe('settle', () => {
  it('pays creditors from debtors until everyone is even', () => {
    const transfers = settle([
      { id: 'a', netMinor: 3000 },
      { id: 'b', netMinor: -1000 },
      { id: 'c', netMinor: -2000 },
    ])
    expect(transfers).toEqual([
      { from: 'c', to: 'a', amountMinor: 2000 },
      { from: 'b', to: 'a', amountMinor: 1000 },
    ])
  })

  it('needs at most n − 1 payments', () => {
    const nets = [500, 700, -300, -400, -250, -250]
    const transfers = settle(nets.map((netMinor, i) => ({ id: String(i), netMinor })))
    expect(transfers.length).toBeLessThanOrEqual(nets.length - 1)
    const after = nets.map((net, i) =>
      transfers.reduce(
        (sum, t) => sum + (t.from === String(i) ? t.amountMinor : 0) - (t.to === String(i) ? t.amountMinor : 0),
        net,
      ),
    )
    expect(after.every((n) => n === 0)).toBe(true)
  })

  it('suggests nothing when everyone is even', () => {
    expect(settle([{ id: 'a', netMinor: 0 }])).toEqual([])
  })
})

describe('tripBalances', () => {
  it('balances the demo trip to the penny', () => {
    const trip = demoTrip()
    const balances = tripBalances(trip)
    expect(balances.countedBills).toBe(3)
    expect(balances.pending).toEqual([])
    expect(balances.people.reduce((sum, p) => sum + p.netMinor, 0)).toBe(0)

    const totalPaid = trip.bills.reduce((sum, b) => sum + (computeBill(b, 'GBP').homeTotalMinor ?? 0), 0)
    expect(balances.people.reduce((sum, p) => sum + p.paidMinor, 0)).toBe(totalPaid)
    expect(balances.people.reduce((sum, p) => sum + p.shareMinor, 0)).toBe(totalPaid)
  })

  it('reproduces the original spreadsheet dinner in the demo', () => {
    const trip = demoTrip()
    const dinner = trip.bills.find((b) => b.name === 'Dinner in Tirana')!
    const result = computeBill(dinner, 'GBP')
    expect(result.homeTotalMinor).toBe(8166)
    expect(Object.values(result.homeSharesMinor!)).toEqual([2512, 1744, 1792, 2118])
  })

  it('leaves unfinished bills out and lists them', () => {
    const trip = demoTrip()
    trip.bills[0]!.payment = { type: 'cash', rate: '' }
    const balances = tripBalances(trip)
    expect(balances.countedBills).toBe(2)
    expect(balances.pending.map((b) => b.id)).toEqual([trip.bills[0]!.id])
  })
})
