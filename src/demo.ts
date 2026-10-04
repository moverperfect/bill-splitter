import { newId } from './domain/format'
import type { AdjustmentLine, Bill, ItemLine, Person, Trip } from './domain/types'

/**
 * A sample trip for first-time visitors: a cash dinner with a double share and a
 * tip, a card bill, and a shared boat trip, so balances have something to settle.
 */
export function demoTrip(): Trip {
  const person = (name: string): Person => ({ id: newId(), name })
  const alex = person('Alex')
  const sam = person('Sam')
  const priya = person('Priya')
  const tom = person('Tom')
  const everyone = [alex.id, sam.id, priya.id, tom.id]
  const cashRate = '40000/384.27'

  const item = (name: string, cost: string, who: string[] | Record<string, number>): ItemLine => ({
    id: newId(),
    kind: 'item',
    name,
    cost,
    weights: Array.isArray(who) ? Object.fromEntries(who.map((id) => [id, 1])) : who,
  })
  const tip = (value: string): AdjustmentLine => ({
    id: newId(),
    kind: 'adjustment',
    name: 'Tip',
    direction: 'add',
    mode: 'fixed',
    value,
    split: 'equal',
  })
  const bill = (partial: Pick<Bill, 'name' | 'date' | 'payerId' | 'payment' | 'lines'>): Bill => ({
    id: newId(),
    currency: 'ALL',
    participantIds: everyone,
    entered: null,
    createdAt: new Date().toISOString(),
    ...partial,
  })

  return {
    id: newId(),
    name: 'Albania (demo)',
    people: [alex, sam, priya, tom],
    currency: 'ALL',
    homeCurrency: 'GBP',
    splitwise: false,
    createdAt: new Date().toISOString(),
    withdrawals: [{ id: newId(), date: '2026-09-01', currency: 'ALL', local: '40000', home: '384.27' }],
    bills: [
      bill({
        name: 'Boat trip',
        date: '2026-09-03',
        payerId: tom.id,
        payment: { type: 'cash', rate: cashRate },
        lines: [item('Boat to the caves', '4×2000', everyone), item('Drinks on board', '2×300', { [alex.id]: 1, [tom.id]: 1 })],
      }),
      bill({
        name: 'Beach club',
        date: '2026-09-02',
        payerId: sam.id,
        payment: { type: 'card', charged: '29.64' },
        lines: [
          item('Sunbeds and food', '2250', everyone),
          item('Fanta', '2×200', [tom.id, priya.id]),
          item('Beer', '300', { [alex.id]: 1 }),
          item('Iced tea', '200', [sam.id]),
        ],
      }),
      bill({
        name: 'Dinner in Tirana',
        date: '2026-09-01',
        payerId: alex.id,
        payment: { type: 'cash', rate: cashRate },
        lines: [
          item('Wine', '350', [tom.id]),
          item('Wine', '350', [priya.id]),
          item('Baklava', '580', everyone),
          item('Lemon soda', '300', [sam.id]),
          item('Moussaka', '950', [priya.id]),
          item('Risotto', '1290', [tom.id]),
          item('Pizza', '950', [sam.id]),
          item('Trileçe', '500', everyone),
          item('Grilled octopus', '1600', [alex.id]),
          item('Kadaif', '580', everyone),
          item('Lager', '2×225', { [alex.id]: 2 }),
          tip('600'),
        ],
      }),
    ],
  }
}
