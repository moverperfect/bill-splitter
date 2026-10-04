export type Evaluated = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'ok'; value: number }

const OPERATORS = /[+\-*/()]/

/**
 * Evaluates a small arithmetic expression typed into an amount field,
 * e.g. "2×350", "40000/384.27" or "1,290". Commas are treated as thousands separators.
 */
export function evaluate(input: string): Evaluated {
  const source = normalise(input)
  if (source === '') return { kind: 'empty' }
  try {
    const parser = new Parser(source)
    const value = parser.parse()
    return Number.isFinite(value) ? { kind: 'ok', value } : { kind: 'invalid' }
  } catch {
    return { kind: 'invalid' }
  }
}

/** Numeric value of an expression, or null if it's empty or invalid. */
export function numericValue(input: string): number | null {
  const result = evaluate(input)
  return result.kind === 'ok' ? result.value : null
}

/** True when the input is a calculation rather than a plain number, so a result preview is useful. */
export function isCalculation(input: string): boolean {
  return OPERATORS.test(normalise(input).replace(/^-/, ''))
}

function normalise(input: string): string {
  return input
    .replace(/[×xX]/g, '*')
    .replace(/÷/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/[,\s_]/g, '')
}

class Parser {
  private pos = 0
  constructor(private readonly src: string) {}

  parse(): number {
    const value = this.expression()
    if (this.pos !== this.src.length) throw new Error('Unexpected input')
    return value
  }

  private expression(): number {
    let value = this.term()
    for (;;) {
      const op = this.src[this.pos]
      if (op !== '+' && op !== '-') return value
      this.pos++
      const rhs = this.term()
      value = op === '+' ? value + rhs : value - rhs
    }
  }

  private term(): number {
    let value = this.factor()
    for (;;) {
      const op = this.src[this.pos]
      if (op !== '*' && op !== '/') return value
      this.pos++
      const rhs = this.factor()
      if (op === '/' && rhs === 0) throw new Error('Division by zero')
      value = op === '*' ? value * rhs : value / rhs
    }
  }

  private factor(): number {
    const ch = this.src[this.pos]
    if (ch === '-' || ch === '+') {
      this.pos++
      const value = this.factor()
      return ch === '-' ? -value : value
    }
    if (ch === '(') {
      this.pos++
      const value = this.expression()
      if (this.src[this.pos] !== ')') throw new Error('Missing )')
      this.pos++
      return value
    }
    const match = /^(\d+\.?\d*|\.\d+)/.exec(this.src.slice(this.pos))
    if (!match) throw new Error('Expected number')
    this.pos += match[0].length
    return Number(match[0])
  }
}
