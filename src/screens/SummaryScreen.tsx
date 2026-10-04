import type { ReactNode } from 'react'
import { Button, Card, CopyButton, Screen, Section } from '../components/ui'
import { formatDate, formatMinor, formatNumber, plainMinor } from '../domain/format'
import { changedSinceEntered, computeBill } from '../domain/split'
import { billStatusLabel } from '../labels'
import { paths } from '../router'
import { mutateBill, useTrip } from '../store'
import { NotFound } from './TripScreen'

/**
 * Who owes what for one bill. In Splitwise mode it follows the order of
 * Splitwise's "Add expense" form, with copy buttons and entered/changed tracking.
 */
export function SummaryScreen({ tripId, billId }: { tripId: string; billId: string }) {
  const trip = useTrip(tripId)
  const bill = trip?.bills.find((b) => b.id === billId)
  if (!trip || !bill) return <NotFound />

  const home = trip.homeCurrency
  const result = computeBill(bill, home)
  const back = paths.bill(trip.id, bill.id)
  const nameOf = (id: string) => trip.people.find((p) => p.id === id)?.name ?? 'Removed person'
  const splitwise = trip.splitwise

  if (result.status !== 'balanced' || result.homeTotalMinor === null || !result.homeSharesMinor || result.rate === null) {
    return (
      <Screen title="Summary" back={back}>
        <p className="text-neutral-500">
          This bill isn't ready yet ({billStatusLabel[result.status].toLowerCase()}). Go back and fix it first.
        </p>
      </Screen>
    )
  }

  const shares = result.homeSharesMinor
  const description = bill.name || 'Bill'
  const notes = `${formatNumber(result.total)} ${bill.currency} @ ${formatNumber(result.rate)} ${bill.currency}/${home}`
  const changed = changedSinceEntered(bill, result)
  const entered = splitwise ? bill.entered : null
  // Copy values are plain decimals ("17.44"), which is what Splitwise's amount fields accept.
  const copy = (text: string) => (splitwise ? text : undefined)

  function markEntered() {
    mutateBill(trip!.id, bill!.id, (b) => {
      b.entered = { enteredAt: new Date().toISOString(), totalMinor: result.homeTotalMinor!, sharesMinor: { ...shares } }
    })
  }

  return (
    <Screen title={splitwise ? 'Splitwise' : 'Summary'} back={back}>
      {entered && changed && (
        <Card className="mb-4 border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
          <p className="mb-2 font-medium text-amber-800 dark:text-amber-300">Changed since entered — update Splitwise</p>
          <ul className="space-y-1 text-sm tabular-nums">
            <DiffRow label="Total" before={entered.totalMinor} after={result.homeTotalMinor} currency={home} />
            {[...new Set([...Object.keys(entered.sharesMinor), ...bill.participantIds])].map((id) => (
              <DiffRow
                key={id}
                label={nameOf(id)}
                before={entered.sharesMinor[id] ?? 0}
                after={shares[id] ?? 0}
                currency={home}
              />
            ))}
          </ul>
        </Card>
      )}

      <Card className="mb-6 divide-y divide-neutral-200 py-0 dark:divide-neutral-800">
        <Row label="Description" value={description} copy={copy(description)} />
        <Row
          label="Amount"
          value={formatMinor(result.homeTotalMinor, home)}
          copy={copy(plainMinor(result.homeTotalMinor, home))}
        />
        <Row label="Date" value={formatDate(bill.date)} />
        <Row label="Paid by" value={nameOf(bill.payerId!)} />
      </Card>

      <Section title={splitwise ? 'Split by exact amounts' : 'Shares'}>
        <Card className="divide-y divide-neutral-200 py-0 dark:divide-neutral-800">
          {bill.participantIds.map((id) => (
            <Row
              key={id}
              label={
                splitwise
                  ? nameOf(id)
                  : id === bill.payerId
                    ? `${nameOf(id)} (paid)`
                    : `${nameOf(id)} owes ${nameOf(bill.payerId!)}`
              }
              value={formatMinor(shares[id] ?? 0, home)}
              copy={copy(plainMinor(shares[id] ?? 0, home))}
            />
          ))}
        </Card>
      </Section>

      <Section title={splitwise ? 'Notes' : 'Conversion'}>
        <Card className="py-0">
          <Row label="Local amount and rate" value={notes} copy={copy(notes)} />
        </Card>
      </Section>

      {splitwise &&
        (!entered ? (
          <Button variant="primary" className="w-full" onClick={markEntered}>
            Mark as entered in Splitwise
          </Button>
        ) : changed ? (
          <Button variant="primary" className="w-full" onClick={markEntered}>
            Mark as updated in Splitwise
          </Button>
        ) : (
          <div className="space-y-2 text-center">
            <p className="font-medium text-emerald-700 dark:text-emerald-400">
              Entered ✓ {new Date(entered.enteredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
            </p>
            <Button variant="ghost" onClick={() => mutateBill(trip.id, bill.id, (b) => void (b.entered = null))}>
              Mark as not entered
            </Button>
          </div>
        ))}

      {!splitwise && (
        <a href={paths.trip(trip.id, 'balances')} className="block text-center font-medium text-emerald-600">
          See trip balances
        </a>
      )}
    </Screen>
  )
}

function Row({ label, value, copy }: { label: string; value: ReactNode; copy?: string }) {
  return (
    <div className="flex min-h-14 items-center gap-2 py-1">
      <div className="min-w-0 flex-1">
        <div className="text-xs text-neutral-500">{label}</div>
        <div className="font-medium break-words tabular-nums">{value}</div>
      </div>
      {copy !== undefined && <CopyButton text={copy} label={label} />}
    </div>
  )
}

function DiffRow({ label, before, after, currency }: { label: string; before: number; after: number; currency: string }) {
  if (before === after) return null
  return (
    <li className="flex justify-between gap-2">
      <span>{label}</span>
      <span>
        {formatMinor(before, currency)} → <strong>{formatMinor(after, currency)}</strong>
      </span>
    </li>
  )
}
