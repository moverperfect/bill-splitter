import { useRef, useState } from 'react'
import { CurrencyInput } from '../components/CurrencyInput'
import { Button, Card, Field, Icon, Screen, Section, TextInput } from '../components/ui'
import { guessHomeCurrency } from '../domain/currency'
import { today } from '../domain/format'
import { migrate } from '../domain/migrate'
import { changedSinceEntered, computeBill } from '../domain/split'
import type { Trip } from '../domain/types'
import { navigate, paths } from '../router'
import { addDemoTrip, createTrip, useStore } from '../store'

export function TripsScreen() {
  const trips = useStore((s) => s.data.trips)
  const [creating, setCreating] = useState(trips.length === 0)

  return (
    <Screen title="Bill Splitter" right={<DataMenu />}>
      {trips.length === 0 && <Welcome />}
      {creating ? (
        <NewTripForm onCancel={trips.length > 0 ? () => setCreating(false) : undefined} />
      ) : (
        <Button variant="primary" className="mb-6 w-full" onClick={() => setCreating(true)}>
          <Icon name="plus" /> New trip
        </Button>
      )}
      {trips.length > 0 && (
        <Section title="Trips">
          <div className="space-y-2">
            {trips.map((trip) => (
              <TripRow key={trip.id} trip={trip} />
            ))}
          </div>
        </Section>
      )}
    </Screen>
  )
}

function Welcome() {
  return (
    <div className="mb-6 space-y-3">
      <p className="text-neutral-600 dark:text-neutral-400">
        Split restaurant bills item by item, in any currency, and see exactly what everyone owes in their own. Everything stays on
        this device and works offline.
      </p>
      <Button className="w-full" onClick={() => navigate(paths.trip(addDemoTrip()))}>
        Try a demo trip
      </Button>
    </div>
  )
}

function TripRow({ trip }: { trip: Trip }) {
  const toEnter = trip.splitwise
    ? trip.bills.filter((b) => {
        const result = computeBill(b, trip.homeCurrency)
        return result.status === 'balanced' && (!b.entered || changedSinceEntered(b, result))
      }).length
    : 0
  return (
    <a href={paths.trip(trip.id)} className="block">
      <Card className="flex items-center gap-3 active:bg-neutral-50 dark:active:bg-neutral-800">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{trip.name || 'Untitled trip'}</div>
          <div className="text-sm text-neutral-500">
            {trip.people.map((p) => p.name).join(', ')} · {trip.bills.length} bill{trip.bills.length === 1 ? '' : 's'}
            {toEnter > 0 && <span className="text-amber-600"> · {toEnter} to enter</span>}
          </div>
        </div>
        <Icon name="chevron" className="text-neutral-400" />
      </Card>
    </a>
  )
}

function NewTripForm({ onCancel }: { onCancel?: () => void }) {
  const [name, setName] = useState('')
  const [currency, setCurrency] = useState('')
  // Home currency rarely changes, so reuse the latest trip's; first time round, guess from the browser.
  const [homeCurrency, setHomeCurrency] = useState(
    () => useStore.getState().data.trips[0]?.homeCurrency ?? guessHomeCurrency(navigator.language),
  )
  const [people, setPeople] = useState(['', ''])

  const names = people.map((p) => p.trim()).filter(Boolean)
  const valid = names.length > 0 && /^[A-Z]{3}$/.test(currency) && /^[A-Z]{3}$/.test(homeCurrency)

  return (
    <Card className="mb-6 space-y-4 p-4">
      <h2 className="text-lg font-semibold">New trip</h2>
      <Field label="Trip name">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Summer trip" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Local currency">
          <CurrencyInput value={currency} onChange={setCurrency} />
        </Field>
        <Field label="Home currency">
          <CurrencyInput value={homeCurrency} onChange={setHomeCurrency} />
        </Field>
      </div>
      <Field label="People">
        <div className="space-y-2">
          {people.map((person, i) => (
            <TextInput
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are only ever appended, never reordered
              key={i}
              value={person}
              placeholder={`Person ${i + 1}`}
              onChange={(e) => {
                const next = [...people]
                next[i] = e.target.value
                if (i === people.length - 1 && e.target.value) next.push('')
                setPeople(next)
              }}
            />
          ))}
        </div>
      </Field>
      <div className="flex gap-2">
        {onCancel && (
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          variant="primary"
          className="flex-1"
          disabled={!valid}
          onClick={() => {
            const id = createTrip(name.trim() || `Trip ${today()}`, currency, homeCurrency, names)
            navigate(paths.trip(id))
          }}
        >
          Create trip
        </Button>
      </div>
    </Card>
  )
}

/** Tucked-away backup: export and import all data as JSON. */
function DataMenu() {
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function exportData() {
    const data = useStore.getState().data
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `bill-splitter-${today()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setOpen(false)
  }

  async function importData(file: File) {
    try {
      const parsed = migrate(JSON.parse(await file.text()))
      const existing = useStore.getState().data.trips
      const incoming = parsed.trips.filter((t) => !existing.some((e) => e.id === t.id))
      const replaced = parsed.trips.length - incoming.length
      const message = `Import ${parsed.trips.length} trip(s)?${replaced > 0 ? ` ${replaced} already exist here and will be replaced.` : ''}`
      if (!confirm(message)) return
      useStore.getState().mutate((d) => {
        const ids = new Set(parsed.trips.map((t) => t.id))
        d.trips = [...parsed.trips, ...d.trips.filter((t) => !ids.has(t.id))]
      })
      setOpen(false)
    } catch (error) {
      alert(`Couldn't import: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="More"
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center rounded-full active:bg-neutral-100 dark:active:bg-neutral-800"
      >
        <Icon name="more" />
      </button>
      {open && (
        <div className="absolute top-full right-0 z-30 mt-1 w-48 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          <button
            type="button"
            className="block h-12 w-full px-4 text-left active:bg-neutral-100 dark:active:bg-neutral-800"
            onClick={exportData}
          >
            Export backup
          </button>
          <button
            type="button"
            className="block h-12 w-full px-4 text-left active:bg-neutral-100 dark:active:bg-neutral-800"
            onClick={() => fileRef.current?.click()}
          >
            Import backup
          </button>
          <button
            type="button"
            className="block h-12 w-full px-4 text-left active:bg-neutral-100 dark:active:bg-neutral-800"
            onClick={() => navigate(paths.trip(addDemoTrip()))}
          >
            Add demo trip
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void importData(file)
              e.target.value = ''
            }}
          />
        </div>
      )}
    </div>
  )
}
