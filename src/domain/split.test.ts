import { describe, expect, it } from 'vitest'
import { allocate, changedSinceEntered, computeBill } from './split'
import type { AdjustmentLine, Bill, ItemLine } from './types'

const people = ['alex', 'sam', 'priya', 'tom']

let nextId = 0
function item(name: string, cost: string, who: string[] | Record<string, number>): ItemLine {
  const weights = Array.isArray(who) ? Object.fromEntries(who.map((id) => [id, 1])) : who
  return { id: `l${nextId++}`, kind: 'item', name, cost, weights }
}

function adjustment(partial: Partial<AdjustmentLine>): AdjustmentLine {
  return {
    id: `l${nextId++}`,
    kind: 'adjustment',
    name: 'Tip',
    direction: 'add',
    mode: 'fixed',
    value: '',
    split: 'equal',
    ...partial,
  }
}

function bill(partial: Partial<Bill>): Bill {
  return {
    id: 'b',
    name: 'Test',
    date: '2026-09-01',
    payerId: 'alex',
    currency: 'ALL',
    participantIds: people,
    payment: { type: 'cash', rate: '40000/384.27' },
    lines: [],
    entered: null,
    createdAt: '2026-09-01T00:00:00Z',
    ...partial,
  }
}

// A real dinner, checked by hand.
const albania = bill({
  lines: [
    item('Wine', '350', ['tom']),
    item('Wine', '350', ['priya']),
    item('Baklava', '580', people),
    item('Lemon soda', '300', ['sam']),
    item('Mousaka', '950', ['priya']),
    item('Risotto', '1290', ['tom']),
    item('Pizza', '950', ['sam']),
    item('Trilec', '500', people),
    item('Octopus grill', '1600', ['alex']),
    item('Kadaif', '580', people),
    item('Lager', '450', ['alex']),
    adjustment({ value: '600' }),
  ],
})

describe('computeBill', () => {
  it('splits the Albania dinner by item', () => {
    const result = computeBill(albania, 'GBP')
    expect(result.status).toBe('balanced')
    expect(result.itemSubtotal).toBe(7900)
    expect(result.total).toBe(8500)
    expect(result.localShares).toEqual({ alex: 2615, sam: 1815, priya: 1865, tom: 2205 })
  })

  it('converts the Albania bill to pence that add up exactly', () => {
    const result = computeBill(albania, 'GBP')
    // 8500 / (40000 / 384.27) = £81.657375
    expect(result.homeTotalMinor).toBe(8166)
    expect(result.homeSharesMinor).toEqual({ alex: 2512, sam: 1744, priya: 1792, tom: 2118 })
  })

  it('reproduces a beach-club bill paid by card', () => {
    const result = computeBill(
      bill({
        payment: { type: 'card', charged: '29.64' },
        lines: [
          item('Food', '2250', people),
          item('Fanta', '400', ['tom', 'priya']),
          item('Beer', '300', ['alex']),
          item('Ice tea', '200', ['sam']),
        ],
      }),
      'GBP',
    )
    expect(result.status).toBe('balanced')
    expect(result.localShares).toEqual({ alex: 862.5, tom: 762.5, priya: 762.5, sam: 762.5 })
    expect(result.rate).toBeCloseTo(3150 / 29.64, 10)
    expect(result.homeTotalMinor).toBe(2964)
    const shares = result.homeSharesMinor!
    expect(Object.values(shares).reduce((a, b) => a + b)).toBe(2964)
    expect(shares.alex).toBe(812)
  })

  it('supports double shares', () => {
    const result = computeBill(bill({ lines: [item('Wine', '300', { alex: 2, tom: 1 })] }), 'GBP')
    expect(result.localShares).toMatchObject({ alex: 200, tom: 100 })
  })

  it('splits a percentage tip in proportion to what people ordered', () => {
    const result = computeBill(
      bill({
        lines: [
          item('Octopus', '1600', ['alex']),
          item('Soda', '400', ['tom']),
          adjustment({ mode: 'percent', value: '10', split: 'proportional' }),
        ],
      }),
      'GBP',
    )
    expect(result.total).toBe(2200)
    expect(result.localShares).toMatchObject({ alex: 1760, tom: 440, sam: 0, priya: 0 })
  })

  it('applies an equal discount', () => {
    const result = computeBill(
      bill({
        lines: [item('Dinner', '4000', people), adjustment({ name: 'Discount', direction: 'subtract', value: '400' })],
      }),
      'GBP',
    )
    expect(result.total).toBe(3600)
    expect(result.localShares.alex).toBe(900)
  })

  it('ignores blank lines', () => {
    const result = computeBill(bill({ lines: [item('Pizza', '950', ['alex']), item('', '', [])] }), 'GBP')
    expect(result.status).toBe('balanced')
  })

  it('ignores weights for people left out of the bill', () => {
    const result = computeBill(
      bill({ participantIds: ['alex', 'tom'], lines: [item('Pizza', '900', ['alex', 'tom', 'sam'])] }),
      'GBP',
    )
    expect(result.localShares).toEqual({ alex: 450, tom: 450 })
  })

  describe('line issues', () => {
    it.each([
      [item('Pizza', '', ['alex']), 'add-cost'],
      [item('Pizza', '-5', ['alex']), 'check-cost'],
      [item('Pizza', 'abc', ['alex']), 'check-cost'],
      [item('Pizza', '950', []), 'assign-people'],
      [adjustment({ value: '' }), 'add-amount'],
      [adjustment({ value: '-1' }), 'check-amount'],
    ] as const)('flags %#', (line, expected) => {
      const result = computeBill(bill({ lines: [item('Beer', '300', ['alex']), line] }), 'GBP')
      expect(result.lines[line.id]?.issue).toBe(expected)
      expect(result.status).toBe('check-lines')
    })

    it('flags a proportional tip with nothing to split', () => {
      const tip = adjustment({ value: '100', split: 'proportional' })
      expect(computeBill(bill({ lines: [tip] }), 'GBP').lines[tip.id]?.issue).toBe('nothing-to-split')
    })
  })

  describe('bill status', () => {
    it.each([
      [bill({ lines: [] }), 'add-items'],
      [bill({ payerId: null, lines: [item('Beer', '300', ['alex'])] }), 'pick-payer'],
      [bill({ payerId: 'nobody', lines: [item('Beer', '300', ['alex'])] }), 'pick-payer'],
      [bill({ lines: [item('Free', '0', ['alex'])] }), 'check-total'],
      [bill({ payment: { type: 'cash', rate: '' }, lines: [item('Beer', '300', ['alex'])] }), 'add-rate'],
      [bill({ payment: { type: 'cash', rate: '0' }, lines: [item('Beer', '300', ['alex'])] }), 'check-rate'],
      [bill({ payment: { type: 'card', charged: '' }, lines: [item('Beer', '300', ['alex'])] }), 'add-charged'],
    ] as const)('%#: %s', (input, expected) => {
      expect(computeBill(input, 'GBP').status).toBe(expected)
    })
  })
})

describe('home currencies with other decimal places', () => {
  const dinner = bill({
    currency: 'EUR',
    payment: { type: 'cash', rate: '1/150' },
    lines: [item('Dinner', '100', ['alex', 'sam', 'priya'])],
  })

  it('rounds yen to whole units', () => {
    const result = computeBill(dinner, 'JPY')
    expect(result.homeTotalMinor).toBe(15000)
    expect(result.homeSharesMinor).toEqual({ alex: 5000, sam: 5000, priya: 5000, tom: 0 })
  })

  it('keeps three decimals for Kuwaiti dinar', () => {
    const result = computeBill({ ...dinner, payment: { type: 'card', charged: '30.001' } }, 'KWD')
    expect(result.homeTotalMinor).toBe(30001)
    expect(Object.values(result.homeSharesMinor!).reduce((a, b) => a + b)).toBe(30001)
  })
})

describe('allocate', () => {
  it('always sums to the total', () => {
    const shares = allocate(100, ['a', 'b', 'c'], { a: 1, b: 1, c: 1 }, 3)
    expect(shares).toEqual({ a: 34, b: 33, c: 33 })
  })

  it('gives leftover pennies to the largest remainders', () => {
    expect(allocate(10, ['a', 'b'], { a: 0.26, b: 0.74 }, 1)).toEqual({ a: 3, b: 7 })
  })
})

describe('changedSinceEntered', () => {
  it('detects when shares no longer match what was entered', () => {
    const result = computeBill(albania, 'GBP')
    const entered = { enteredAt: 'x', totalMinor: 8166, sharesMinor: { ...result.homeSharesMinor! } }
    expect(changedSinceEntered({ ...albania, entered }, result)).toBe(false)
    const changed = { ...entered, sharesMinor: { ...entered.sharesMinor, alex: 1 } }
    expect(changedSinceEntered({ ...albania, entered: changed }, result)).toBe(true)
  })
})
