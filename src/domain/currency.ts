const digitsCache = new Map<string, number>()

/** Decimal places a currency uses: 2 for GBP, 0 for JPY, 3 for KWD. Unknown codes fall back to 2. */
export function minorDigits(currency: string): number {
  const key = currency.toUpperCase()
  let digits = digitsCache.get(key)
  if (digits === undefined) {
    try {
      digits = new Intl.NumberFormat('en', { style: 'currency', currency: key }).resolvedOptions().maximumFractionDigits ?? 2
    } catch {
      digits = 2
    }
    digitsCache.set(key, digits)
  }
  return digits
}

/** Minor units per major unit: 100 for GBP, 1 for JPY, 1000 for KWD. */
export function minorFactor(currency: string): number {
  return 10 ** minorDigits(currency)
}

/** Short symbol for labels, e.g. "£" for GBP or "CHF" when there is no symbol. */
export function currencySymbol(currency: string): string {
  try {
    const parts = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).formatToParts(0)
    return parts.find((p) => p.type === 'currency')?.value ?? currency
  } catch {
    return currency
  }
}

export interface CurrencyOption {
  code: string
  name: string
}

let options: CurrencyOption[] | null = null

/** Every currency the browser knows, with display names, for the currency picker. */
export function currencyOptions(): CurrencyOption[] {
  if (options) return options
  const codes = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('currency') : FALLBACK_CODES
  let names: Intl.DisplayNames | null = null
  try {
    names = new Intl.DisplayNames(undefined, { type: 'currency' })
  } catch {
    // Older browsers: show bare codes.
  }
  options = codes.map((code) => ({ code, name: names?.of(code) ?? code }))
  return options
}

const FALLBACK_CODES = ['AUD', 'CAD', 'CHF', 'CNY', 'EUR', 'GBP', 'HKD', 'INR', 'JPY', 'NZD', 'SEK', 'SGD', 'USD']

/** Best guess at someone's home currency from a locale such as "en-US" or "de-AT". */
export function guessHomeCurrency(locale: string | undefined): string {
  try {
    const region = locale ? new Intl.Locale(locale).maximize().region : undefined
    if (region && EURO_REGIONS.has(region)) return 'EUR'
    return (region && REGION_CURRENCIES[region]) || 'USD'
  } catch {
    return 'USD'
  }
}

// biome-ignore format: compact lookup table
const EURO_REGIONS = new Set([
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'HR', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT', 'NL', 'PT', 'SI', 'SK',
])

// biome-ignore format: compact lookup table
const REGION_CURRENCIES: Record<string, string> = {
  AE: 'AED', AR: 'ARS', AU: 'AUD', BG: 'BGN', BR: 'BRL', CA: 'CAD', CH: 'CHF', CL: 'CLP', CN: 'CNY', CO: 'COP',
  CZ: 'CZK', DK: 'DKK', EG: 'EGP', GB: 'GBP', HK: 'HKD', HU: 'HUF', ID: 'IDR', IL: 'ILS', IN: 'INR', IS: 'ISK',
  JP: 'JPY', KR: 'KRW', MA: 'MAD', MX: 'MXN', MY: 'MYR', NG: 'NGN', NO: 'NOK', NZ: 'NZD', PH: 'PHP', PK: 'PKR',
  PL: 'PLN', RO: 'RON', RS: 'RSD', SA: 'SAR', SE: 'SEK', SG: 'SGD', TH: 'THB', TR: 'TRY', TW: 'TWD', UA: 'UAH',
  US: 'USD', VN: 'VND', ZA: 'ZAR',
}
