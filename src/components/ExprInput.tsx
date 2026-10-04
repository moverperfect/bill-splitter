import { useRef, useState } from 'react'
import { evaluate, isCalculation } from '../domain/expr'
import { formatNumber } from '../domain/format'
import { cx, inputClass } from './ui'

const OPERATORS = ['+', '−', '×', '÷', '(', ')']

/**
 * Amount field that accepts sums like "2×350" or "40000/384.27".
 * Phone number pads have no operator keys, so a small operator row appears above the field while focused
 * (above, so it never covers the person chips you tap next).
 */
export function ExprInput({
  value,
  onChange,
  placeholder,
  className,
  inputClassName,
  ariaLabel,
  autoFocus,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  inputClassName?: string
  ariaLabel?: string
  autoFocus?: boolean
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [focused, setFocused] = useState(false)
  const result = evaluate(value)
  const invalid = result.kind === 'invalid'
  const preview = isCalculation(value) ? (result.kind === 'ok' ? `= ${formatNumber(result.value, 4)}` : 'Check sum') : null

  function insert(op: string) {
    const input = ref.current
    if (!input) return
    const start = input.selectionStart ?? value.length
    const end = input.selectionEnd ?? value.length
    const next = value.slice(0, start) + op + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => input.setSelectionRange(start + op.length, start + op.length))
  }

  return (
    <div className={cx('relative', className)}>
      <input
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        inputMode="decimal"
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-invalid={invalid}
        placeholder={placeholder}
        className={cx(inputClass, 'text-right tabular-nums', invalid && 'border-amber-500', inputClassName)}
      />
      {preview && !focused && (
        <div className={cx('mt-0.5 text-right text-xs tabular-nums', invalid ? 'text-amber-600' : 'text-neutral-500')}>
          {preview}
        </div>
      )}
      {focused && (
        <div
          className="absolute right-0 bottom-full z-30 mb-1 flex gap-1 rounded-xl border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
          onPointerDown={(e) => e.preventDefault()}
        >
          {preview && (
            <span
              className={cx(
                'self-center px-2 text-sm whitespace-nowrap tabular-nums',
                invalid ? 'text-amber-600' : 'text-neutral-500',
              )}
            >
              {preview}
            </span>
          )}
          {OPERATORS.map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => insert(op)}
              className="grid size-10 place-items-center rounded-lg text-lg font-medium active:bg-neutral-100 dark:active:bg-neutral-800"
            >
              {op}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
