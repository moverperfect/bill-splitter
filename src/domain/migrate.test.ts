import { describe, expect, it } from 'vitest'
import { guessHomeCurrency, minorDigits } from './currency'
import { migrate } from './migrate'

const v1Trip = {
  id: 't',
  name: 'Old trip',
  people: [{ id: 'p', name: 'Alex' }],
  currency: 'EUR',
  homeCurrency: 'GBP',
  withdrawals: [],
  bills: [],
  createdAt: '2026-09-01T00:00:00Z',
}

describe('migrate', () => {
  it('upgrades v1 data and keeps Splitwise mode on for existing trips', () => {
    const data = migrate({ version: 1, trips: [v1Trip] })
    expect(data.version).toBe(2)
    expect(data.trips[0]).toEqual({ ...v1Trip, splitwise: true })
  })

  it('leaves current data alone', () => {
    const current = { version: 2, trips: [{ ...v1Trip, splitwise: false }] }
    expect(migrate(current)).toEqual(current)
  })

  it.each([null, 'nope', { trips: 'x' }, { version: 99, trips: [] }])('rejects %j', (value) => {
    expect(() => migrate(value)).toThrow()
  })
})

describe('currency helpers', () => {
  it.each([
    ['GBP', 2],
    ['JPY', 0],
    ['KWD', 3],
    ['XYZ', 2],
  ])('%s has %i decimal places', (code, digits) => {
    expect(minorDigits(code)).toBe(digits)
  })

  it.each([
    ['en-GB', 'GBP'],
    ['en-US', 'USD'],
    ['de-AT', 'EUR'],
    ['ja', 'JPY'],
    ['en', 'USD'],
    [undefined, 'USD'],
  ])('guesses %s → %s', (locale, currency) => {
    expect(guessHomeCurrency(locale)).toBe(currency)
  })
})
