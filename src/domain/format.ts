import { minorDigits, minorFactor } from './currency'

const formatters = new Map<string, Intl.NumberFormat>()

// Numbers and dates follow the browser's locale; `undefined` picks it up.

/** Formats an amount with its currency symbol, e.g. "£17.44" or "ALL 2,615". */
export function formatMoney(amount: number, currency: string): string {
  const key = currency.toUpperCase()
  let formatter = formatters.get(key)
  if (!formatter) {
    try {
      // Local amounts can be fractional shares, so allow at least 2 places even for whole-unit currencies.
      formatter = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: key,
        maximumFractionDigits: Math.max(2, minorDigits(key)),
      })
    } catch {
      formatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })
    }
    formatters.set(key, formatter)
  }
  const text = formatter.format(amount)
  return formatter.resolvedOptions().style === 'currency' ? text : `${text} ${key}`
}

/** Formats minor units (pence, cents) with every decimal place shown, e.g. "£17.40". */
export function formatMinor(minor: number, currency: string): string {
  const digits = minorDigits(currency)
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(minor / minorFactor(currency))
  } catch {
    return `${plainMinor(minor, currency)} ${currency}`
  }
}

/** Plain decimal for pasting into other apps, e.g. "17.44", or "2615" for zero-decimal currencies. */
export function plainMinor(minor: number, currency: string): string {
  return (minor / minorFactor(currency)).toFixed(minorDigits(currency))
}

export function formatNumber(value: number, maximumFractionDigits = 2): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits }).format(value)
}

export function formatDate(iso: string): string {
  if (!iso) return ''
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}

export function today(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

/** Random id. Avoids crypto.randomUUID, which is missing on plain-http LAN addresses. */
export function newId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}
