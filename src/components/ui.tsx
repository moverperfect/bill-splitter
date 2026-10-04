import { type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, useState } from 'react'

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function Screen({
  title,
  back,
  right,
  children,
  footer,
}: {
  title: ReactNode
  back?: string
  right?: ReactNode
  children: ReactNode
  footer?: ReactNode
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-1 border-b border-neutral-200 bg-white/90 px-2 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        {back ? (
          <a
            href={back}
            aria-label="Back"
            className="grid size-11 place-items-center rounded-full active:bg-neutral-100 dark:active:bg-neutral-800"
          >
            <Icon name="back" />
          </a>
        ) : (
          <div className="w-2" />
        )}
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{title}</h1>
        {right}
      </header>
      <main className={cx('flex-1 px-4 py-4', footer ? 'pb-40' : 'pb-[calc(env(safe-area-inset-bottom)+2rem)]')}>{children}</main>
      {footer}
    </div>
  )
}

export function Section({ title, action, children }: { title?: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="mb-6">
      {(title || action) && (
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-medium tracking-wide text-neutral-500 uppercase">{title}</h2>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('rounded-2xl border border-neutral-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900', className)}
    >
      {children}
    </div>
  )
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'secondary',
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 font-medium transition-colors disabled:opacity-40',
        variant === 'primary' && 'bg-emerald-600 text-white active:bg-emerald-700',
        variant === 'secondary' &&
          'bg-neutral-100 text-neutral-900 active:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:active:bg-neutral-700',
        variant === 'ghost' && 'text-neutral-600 active:bg-neutral-100 dark:text-neutral-300 dark:active:bg-neutral-800',
        variant === 'danger' && 'text-red-600 active:bg-red-50 dark:text-red-400 dark:active:bg-red-950',
        className,
      )}
      {...props}
    />
  )
}

export const inputClass =
  'h-12 w-full min-w-0 rounded-xl border border-neutral-300 bg-white px-3 text-base outline-none placeholder:text-neutral-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 dark:border-neutral-700 dark:bg-neutral-950'

export function TextInput({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(inputClass, className)} {...props} />
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-neutral-600 dark:text-neutral-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-sm text-neutral-500">{hint}</span>}
    </label>
  )
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T
  options: { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div className={cx('flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'h-10 flex-1 rounded-lg px-2 text-sm font-medium',
            o.value === value ? 'bg-white shadow-sm dark:bg-neutral-950' : 'text-neutral-500',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Chip({
  selected,
  onClick,
  children,
  className,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex h-10 items-center gap-1 rounded-full border px-4 text-sm font-medium',
        selected
          ? 'border-emerald-600 bg-emerald-600 text-white'
          : 'border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300',
        className,
      )}
    >
      {children}
    </button>
  )
}

export type Tone = 'ok' | 'warn' | 'muted'

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        'inline-flex h-7 shrink-0 items-center rounded-full px-3 text-sm font-medium whitespace-nowrap',
        tone === 'ok' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
        tone === 'warn' && 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
        tone === 'muted' && 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400',
      )}
    >
      {children}
    </span>
  )
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        await copyText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1200)
      }}
      className={cx(
        'grid size-11 shrink-0 place-items-center rounded-xl',
        copied ? 'text-emerald-600' : 'text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800',
      )}
    >
      <Icon name={copied ? 'check' : 'copy'} />
    </button>
  )
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard API needs a secure context; fall back for plain-http testing.
    const area = document.createElement('textarea')
    area.value = text
    document.body.append(area)
    area.select()
    document.execCommand('copy')
    area.remove()
  }
}

const icons = {
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  check: 'M5 12l5 5L20 7',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
  chevron: 'M9 6l6 6-6 6',
  sliders: 'M4 8h10M18 8h2M4 16h2M10 16h10M14 6v4M6 14v4',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
} as const

export function Icon({ name, className }: { name: keyof typeof icons; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={cx('size-6', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth={name === 'more' ? 3 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={icons[name]} />
    </svg>
  )
}
