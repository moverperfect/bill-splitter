import { describe, expect, it } from 'vitest'
import { evaluate, isCalculation, numericValue } from './expr'

describe('evaluate', () => {
  it.each([
    ['350', 350],
    ['2×350', 700],
    ['2x350', 700],
    ['40000/384.27', 40000 / 384.27],
    ['3150 ÷ 29.64', 3150 / 29.64],
    ['1,290', 1290],
    ['(350+580)/4', 232.5],
    ['1+2*3', 7],
    ['-5+10', 5],
    ['10 − 2', 8],
    ['.5', 0.5],
  ])('%s = %d', (input, expected) => {
    expect(numericValue(input)).toBeCloseTo(expected, 10)
  })

  it('treats blank as empty', () => {
    expect(evaluate('  ')).toEqual({ kind: 'empty' })
  })

  it.each(['abc', '2**3', '1/0', '(1+2', '5+', '1.2.3'])('rejects %s', (input) => {
    expect(evaluate(input)).toEqual({ kind: 'invalid' })
  })
})

describe('isCalculation', () => {
  it('spots calculations but not plain or negative numbers', () => {
    expect(isCalculation('2×350')).toBe(true)
    expect(isCalculation('350')).toBe(false)
    expect(isCalculation('-350')).toBe(false)
    expect(isCalculation('1,290')).toBe(false)
  })
})
