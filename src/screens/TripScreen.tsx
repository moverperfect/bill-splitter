import { useState } from 'react'
import { CurrencyInput } from '../components/CurrencyInput'
import { ExprInput } from '../components/ExprInput'
import { Button, Card, cx, Field, Icon, Pill, Screen, Section, TextInput, type Tone } from '../components/ui'
import { formatDate, formatMinor, formatMoney, formatNumber, newId, today } from '../domain/format'
import { changedSinceEntered, computeBill } from '../domain/split'
import type { Bill, Trip } from '../domain/types'
import { billStatusLabel } from '../labels'
import { navigate, paths, type TripTab } from '../router'
import { createBill, mutateTrip, removePerson, useStore, useTrip, withdrawalRate } from '../store'
import { BalancesTab } from './BalancesTab'

export function TripScreen({ tripId, tab }: { tripId: string; tab: TripTab }) {
  const trip = useTrip(tripId)
  if (!trip) return <NotFound />

  return (
    <Screen title={trip.name || 'Untitled trip'} back={paths.trips()}>
      <nav className="mb-4 flex rounded-xl bg-neutral-100 p-1 dark:bg-neutral-800">
        {(
          [
            ['bills', 'Bills'],
            ['balances', 'Balances'],
            ['cash', 'Cash'],
            ['trip', 'Trip'],
          ] as const
        ).map(([value, label]) => (
          <a
            key={value}
            href={paths.trip(trip.id, value)}
            className={cx(
              'grid h-10 flex-1 place-items-center rounded-lg text-sm font-medium',
              tab === value ? 'bg-white shadow-sm dark:bg-neutral-950' : 'text-neutral-500',
            )}
          >
            {label}
          </a>
        ))}
      </nav>
      {tab === 'bills' && <BillsTab trip={trip} />}
      {tab === 'balances' && <BalancesTab trip={trip} />}
      {tab === 'cash' && <CashTab trip={trip} />}
      {tab === 'trip' && <TripSettingsTab trip={trip} />}
    </Screen>
  )
}

function BillsTab({ trip }: { trip: Trip }) {
  return (
    <>
      <Button variant="primary" className="mb-4 w-full" onClick={() => navigate(paths.bill(trip.id, createBill(trip.id)))}>
        <Icon name="plus" /> New bill
      </Button>
      {trip.bills.length === 0 ? (
        <p className="py-8 text-center text-neutral-500">No bills yet.</p>
      ) : (
        <div className="space-y-2">
          {trip.bills.map((bill) => (
            <BillRow key={bill.id} trip={trip} bill={bill} />
          ))}
        </div>
      )}
    </>
  )
}

function BillRow({ trip, bill }: { trip: Trip; bill: Bill }) {
  const result = computeBill(bill, trip.homeCurrency)
  const [label, tone] = billBadge(trip, bill, result)
  return (
    <a href={paths.bill(trip.id, bill.id)} className="block">
      <Card className="flex items-center gap-3 active:bg-neutral-50 dark:active:bg-neutral-800">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{bill.name || 'Untitled bill'}</div>
          <div className="text-sm text-neutral-500 tabular-nums">
            {formatDate(bill.date)} · {formatMoney(result.total, bill.currency)}
            {result.homeTotalMinor !== null && ` · ${formatMinor(result.homeTotalMinor, trip.homeCurrency)}`}
          </div>
        </div>
        <Pill tone={tone}>{label}</Pill>
      </Card>
    </a>
  )
}

function billBadge(trip: Trip, bill: Bill, result: ReturnType<typeof computeBill>): [string, Tone] {
  if (trip.splitwise) {
    if (bill.entered) return changedSinceEntered(bill, result) ? ['Changed', 'warn'] : ['Entered ✓', 'ok']
    if (result.status === 'balanced') return ['To enter', 'muted']
  }
  return [billStatusLabel[result.status], result.status === 'balanced' ? 'ok' : 'warn']
}

function CashTab({ trip }: { trip: Trip }) {
  return (
    <>
      <p className="mb-4 text-sm text-neutral-500">
        Record cash withdrawals to set the rate for cash bills. Include any fees in the amount debited, so they get shared too.
      </p>
      <Button
        variant="primary"
        className="mb-4 w-full"
        onClick={() =>
          mutateTrip(trip.id, (t) => {
            t.withdrawals.unshift({ id: newId(), date: today(), currency: t.currency, local: '', home: '' })
          })
        }
      >
        <Icon name="plus" /> Add withdrawal
      </Button>
      <div className="space-y-3">
        {trip.withdrawals.map((w) => {
          const rate = withdrawalRate(w)
          const update = (patch: Partial<typeof w>) =>
            mutateTrip(trip.id, (t) => {
              const target = t.withdrawals.find((x) => x.id === w.id)
              if (target) Object.assign(target, patch)
            })
          return (
            <Card key={w.id} className="space-y-3">
              <div className="grid grid-cols-[1fr_6rem] gap-3">
                <Field label="Date">
                  <TextInput type="date" value={w.date} onChange={(e) => update({ date: e.target.value })} />
                </Field>
                <Field label="Currency">
                  <CurrencyInput value={w.currency} onChange={(currency) => update({ currency })} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={`${w.currency || 'Local'} received`}>
                  <ExprInput value={w.local} onChange={(local) => update({ local })} placeholder="200" />
                </Field>
                <Field label={`${trip.homeCurrency} debited`}>
                  <ExprInput value={w.home} onChange={(home) => update({ home })} placeholder="173.40" />
                </Field>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-neutral-500 tabular-nums">
                  {rate ? `${formatNumber(rate, 4)} ${w.currency} per 1 ${trip.homeCurrency}` : 'Enter both amounts'}
                </span>
                <Button
                  variant="danger"
                  className="h-10"
                  onClick={() => {
                    if (confirm('Delete this withdrawal? Bills keep the rate they already have.'))
                      mutateTrip(trip.id, (t) => {
                        t.withdrawals = t.withdrawals.filter((x) => x.id !== w.id)
                      })
                  }}
                >
                  <Icon name="trash" className="size-5" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>
    </>
  )
}

function TripSettingsTab({ trip }: { trip: Trip }) {
  const [newPerson, setNewPerson] = useState('')

  function addPerson() {
    const name = newPerson.trim()
    if (!name) return
    mutateTrip(trip.id, (t) => {
      const id = newId()
      t.people.push({ id, name })
      // Bills that already have lines keep their split; only empty bills pick up the new person.
      for (const bill of t.bills) if (!bill.entered && bill.lines.length === 0) bill.participantIds.push(id)
    })
    setNewPerson('')
  }

  return (
    <>
      <Section title="Details">
        <div className="space-y-3">
          <Field label="Trip name">
            <TextInput value={trip.name} onChange={(e) => mutateTrip(trip.id, (t) => void (t.name = e.target.value))} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Local currency" hint="Default for new bills">
              <CurrencyInput value={trip.currency} onChange={(c) => mutateTrip(trip.id, (t) => void (t.currency = c))} />
            </Field>
            <Field label="Home currency" hint="What everyone settles up in">
              <CurrencyInput value={trip.homeCurrency} onChange={(c) => mutateTrip(trip.id, (t) => void (t.homeCurrency = c))} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Splitwise mode">
        <label className="flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 accent-emerald-600"
            checked={trip.splitwise}
            onChange={(e) => mutateTrip(trip.id, (t) => void (t.splitwise = e.target.checked))}
          />
          <span className="text-sm text-neutral-600 dark:text-neutral-400">
            Copy each bill's amounts into Splitwise ("split by exact amounts"), and track which bills you've entered and which
            changed afterwards.
          </span>
        </label>
      </Section>

      <Section title="People">
        <div className="space-y-2">
          {trip.people.map((person) => (
            <div key={person.id} className="flex gap-2">
              <TextInput
                value={person.name}
                aria-label="Name"
                onChange={(e) =>
                  mutateTrip(trip.id, (t) => {
                    const target = t.people.find((p) => p.id === person.id)
                    if (target) target.name = e.target.value
                  })
                }
              />
              <Button
                variant="danger"
                aria-label={`Remove ${person.name}`}
                onClick={() => {
                  const used = trip.bills.some((b) => b.participantIds.includes(person.id))
                  const warning = used ? ` They'll be removed from ${trip.bills.length} bill(s), which changes those splits.` : ''
                  if (confirm(`Remove ${person.name}?${warning}`)) removePerson(trip.id, person.id)
                }}
              >
                <Icon name="trash" className="size-5" />
              </Button>
            </div>
          ))}
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              addPerson()
            }}
          >
            <TextInput value={newPerson} onChange={(e) => setNewPerson(e.target.value)} placeholder="Add person" />
            <Button type="submit" disabled={!newPerson.trim()} aria-label="Add person">
              <Icon name="plus" />
            </Button>
          </form>
        </div>
      </Section>

      <Button
        variant="danger"
        className="w-full"
        onClick={() => {
          if (confirm(`Delete "${trip.name}" and all its bills? This can't be undone.`)) {
            useStore.getState().mutate((d) => {
              d.trips = d.trips.filter((t) => t.id !== trip.id)
            })
            navigate(paths.trips(), { replace: true })
          }
        }}
      >
        Delete trip
      </Button>
    </>
  )
}

export function NotFound() {
  return (
    <Screen title="Not found" back={paths.trips()}>
      <p className="text-neutral-500">This trip or bill doesn't exist on this device.</p>
    </Screen>
  )
}
