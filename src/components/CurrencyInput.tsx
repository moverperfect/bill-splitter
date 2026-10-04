import { currencyOptions } from '../domain/currency'
import { TextInput } from './ui'

export function CurrencyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <TextInput
      value={value}
      onChange={(e) =>
        onChange(
          e.target.value
            .toUpperCase()
            .replace(/[^A-Z]/g, '')
            .slice(0, 3),
        )
      }
      list="currencies"
      autoCapitalize="characters"
      autoComplete="off"
      placeholder="Code"
      aria-label="Currency code"
      className="uppercase"
    />
  )
}

/** One datalist of every currency for all CurrencyInputs, rendered once at the root. */
export function CurrencyList() {
  return (
    <datalist id="currencies">
      {currencyOptions().map((c) => (
        <option key={c.code} value={c.code}>
          {c.name}
        </option>
      ))}
    </datalist>
  )
}
