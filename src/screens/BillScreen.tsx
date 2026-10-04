import { type ReactNode, useState } from 'react'
import { CurrencyInput } from '../components/CurrencyInput'
import { ExprInput } from '../components/ExprInput'
import { Button, Card, Chip, cx, Field, Icon, Pill, Screen, Section, Segmented, TextInput } from '../components/ui'
import { numericValue } from '../domain/expr'
import { formatMinor, formatMoney, formatNumber, newId } from '../domain/format'
import { type BillResult, computeBill, type LineResult } from '../domain/split'
import type { AdjustmentLine, Bill, Id, ItemLine, Line, Person, Trip } from '../domain/types'
import { billStatusLabel, chargedLabel, lineIssueLabel } from '../labels'
import { navigate, paths } from '../router'
import { latestWithdrawal, mutateBill, mutateTrip, rateExpression, useTrip } from '../store'
import { NotFound } from './TripScreen'

export function BillScreen({ tripId, billId }: { tripId: string; billId: string }) {
  const trip = useTrip(tripId)
  const bill = trip?.bills.find((b) => b.id === billId)
  const [focusLineId, setFocusLineId] = useState<Id | null>(null)
  if (!trip || !bill) return <NotFound />

  const result = computeBill(bill, trip.homeCurrency)
  const update = (recipe: (bill: Bill, trip: Trip) => void) => mutateBill(trip.id, bill.id, recipe)
  const participants = trip.people.filter((p) => bill.participantIds.includes(p.id))

  function addLine(line: Line) {
    update((b) => {
      // Keep tips and discounts at the bottom, after the items they apply to.
      const firstAdjustment = b.lines.findIndex((l) => l.kind === 'adjustment')
      if (line.kind === 'item' && firstAdjustment >= 0) b.lines.splice(firstAdjustment, 0, line)
      else b.lines.push(line)
    })
    setFocusLineId(line.id)
  }

  return (
    <Screen
      title={bill.name || 'New bill'}
      back={paths.trip(trip.id)}
      right={
        <button
          type="button"
          aria-label="Delete bill"
          className="grid size-11 place-items-center rounded-full text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800"
          onClick={() => {
            if (confirm('Delete this bill?')) {
              mutateTrip(trip.id, (t) => {
                t.bills = t.bills.filter((b) => b.id !== bill.id)
              })
              navigate(paths.trip(trip.id), { replace: true })
            }
          }}
        >
          <Icon name="trash" className="size-5" />
        </button>
      }
      footer={<BillFooter trip={trip} bill={bill} result={result} participants={participants} />}
    >
      <Section>
        <div className="space-y-3">
          <TextInput
            value={bill.name}
            onChange={(e) => update((b) => void (b.name = e.target.value))}
            placeholder="Restaurant or bill name"
            className="text-lg font-medium"
          />
          <div className="grid grid-cols-[1fr_6rem] gap-3">
            <Field label="Date">
              <TextInput type="date" value={bill.date} onChange={(e) => update((b) => void (b.date = e.target.value))} />
            </Field>
            <Field label="Currency">
              <CurrencyInput
                value={bill.currency}
                onChange={(currency) =>
                  update((b, t) => {
                    b.currency = currency
                    if (b.payment.type === 'cash') {
                      const w = latestWithdrawal(t, currency)
                      b.payment.rate = w ? rateExpression(w) : ''
                    }
                  })
                }
              />
            </Field>
          </div>
          <PaymentFields trip={trip} bill={bill} result={result} update={update} />
        </div>
      </Section>

      <Section title="Paid by">
        <div className="flex flex-wrap gap-2">
          {participants.map((p) => (
            <Chip key={p.id} selected={bill.payerId === p.id} onClick={() => update((b) => void (b.payerId = p.id))}>
              {p.name}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="Who's in">
        <div className="flex flex-wrap gap-2">
          {trip.people.map((p) => {
            const included = bill.participantIds.includes(p.id)
            return (
              <Chip
                key={p.id}
                selected={included}
                onClick={() =>
                  update((b, t) => {
                    const ids = new Set(b.participantIds)
                    if (included) ids.delete(p.id)
                    else ids.add(p.id)
                    b.participantIds = t.people.map((x) => x.id).filter((id) => ids.has(id))
                  })
                }
              >
                {p.name}
              </Chip>
            )
          })}
        </div>
      </Section>

      <Section title="Lines">
        <div className="space-y-3">
          {bill.lines.map((line) => (
            <LineEditor
              key={line.id}
              line={line}
              bill={bill}
              result={result.lines[line.id]}
              participants={participants}
              autoFocus={line.id === focusLineId}
              update={update}
            />
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <Button variant="primary" onClick={() => addLine({ id: newId(), kind: 'item', name: '', cost: '', weights: {} })}>
            <Icon name="plus" className="size-5" /> Item
          </Button>
          <Button onClick={() => addLine(newAdjustment('add'))}>+ Tip / fee</Button>
          <Button onClick={() => addLine(newAdjustment('subtract'))}>− Discount</Button>
        </div>
      </Section>
    </Screen>
  )
}

function newAdjustment(direction: AdjustmentLine['direction']): AdjustmentLine {
  return {
    id: newId(),
    kind: 'adjustment',
    name: direction === 'add' ? 'Tip' : 'Discount',
    direction,
    mode: 'fixed',
    value: '',
    split: 'equal',
  }
}

type Update = (recipe: (bill: Bill, trip: Trip) => void) => void

function PaymentFields({ trip, bill, result, update }: { trip: Trip; bill: Bill; result: BillResult; update: Update }) {
  const withdrawal = latestWithdrawal(trip, bill.currency)
  const latestRate = withdrawal ? rateExpression(withdrawal) : null

  return (
    <div className="space-y-3">
      <Segmented
        value={bill.payment.type}
        options={[
          { value: 'cash', label: 'Cash' },
          { value: 'card', label: 'Card' },
        ]}
        onChange={(type) =>
          update((b) => {
            if (b.payment.type === type) return
            b.payment = type === 'cash' ? { type, rate: latestRate ?? '' } : { type, charged: '' }
          })
        }
      />
      {bill.payment.type === 'cash' ? (
        <Field
          label={`Rate (${bill.currency} per 1 ${trip.homeCurrency})`}
          hint={
            latestRate === null ? (
              <>
                No {bill.currency} withdrawal yet.{' '}
                <a className="text-emerald-600 underline" href={paths.trip(trip.id, 'cash')}>
                  Add one
                </a>{' '}
                or type a rate.
              </>
            ) : bill.payment.rate !== latestRate ? (
              <button
                type="button"
                className="text-emerald-600 underline"
                onClick={() => update((b) => void (b.payment = { type: 'cash', rate: latestRate }))}
              >
                Use latest withdrawal ({latestRate})
              </button>
            ) : (
              'From your latest withdrawal'
            )
          }
        >
          <ExprInput
            value={bill.payment.rate}
            onChange={(rate) => update((b) => void (b.payment = { type: 'cash', rate }))}
            placeholder="200/173.40"
          />
        </Field>
      ) : (
        <Field
          label={chargedLabel(trip.homeCurrency)}
          hint={
            result.rate
              ? `Effective rate ${formatNumber(result.rate)} ${bill.currency} per 1 ${trip.homeCurrency}`
              : 'From your banking app, including any fees'
          }
        >
          <ExprInput
            value={bill.payment.charged}
            onChange={(charged) => update((b) => void (b.payment = { type: 'card', charged }))}
            placeholder="0.00"
          />
        </Field>
      )}
    </div>
  )
}

function LineEditor({
  line,
  bill,
  result,
  participants,
  autoFocus,
  update,
}: {
  line: Line
  bill: Bill
  result: LineResult | undefined
  participants: Person[]
  autoFocus: boolean
  update: Update
}) {
  const updateLine = <T extends Line>(recipe: (line: T) => void) =>
    update((b) => {
      const target = b.lines.find((l) => l.id === line.id)
      if (target) recipe(target as T)
    })
  const issue = result?.issue
  const deleteButton = (
    <button
      type="button"
      aria-label="Delete line"
      onClick={() => update((b) => void (b.lines = b.lines.filter((l) => l.id !== line.id)))}
      className="ml-auto grid size-10 shrink-0 place-items-center rounded-lg text-neutral-400 active:bg-neutral-100 dark:active:bg-neutral-800"
    >
      <Icon name="trash" className="size-5" />
    </button>
  )

  return (
    <Card className={cx('space-y-3', issue && 'border-amber-400 dark:border-amber-700')}>
      {line.kind === 'item' ? (
        <ItemFields line={line} participants={participants} autoFocus={autoFocus} update={updateLine} trailing={deleteButton} />
      ) : (
        <AdjustmentFields
          line={line}
          bill={bill}
          result={result}
          autoFocus={autoFocus}
          update={updateLine}
          trailing={deleteButton}
        />
      )}
      {issue && <div className="text-sm text-amber-600">{lineIssueLabel[issue]}</div>}
    </Card>
  )
}

function ItemFields({
  line,
  participants,
  autoFocus,
  update,
  trailing,
}: {
  line: ItemLine
  participants: Person[]
  autoFocus: boolean
  update: (recipe: (line: ItemLine) => void) => void
  trailing: ReactNode
}) {
  const [showWeights, setShowWeights] = useState(() => Object.values(line.weights).some((w) => w > 1))
  const weight = (id: Id) => line.weights[id] ?? 0
  const everyone = participants.length > 0 && participants.every((p) => weight(p.id) > 0)

  return (
    <>
      <div className="flex gap-2">
        <TextInput
          value={line.name}
          onChange={(e) => update((l) => void (l.name = e.target.value))}
          placeholder="Item"
          autoFocus={autoFocus}
          className="flex-1"
        />
        <ExprInput
          value={line.cost}
          onChange={(cost) => update((l) => void (l.cost = cost))}
          placeholder="0"
          className="w-32"
          ariaLabel="Cost"
        />
      </div>
      {showWeights ? (
        <div className="space-y-1">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between">
              <span>{p.name}</span>
              <div className="flex items-center gap-1">
                <Button
                  className="size-10 px-0"
                  aria-label={`Less for ${p.name}`}
                  onClick={() => update((l) => void (l.weights[p.id] = Math.max(0, weight(p.id) - 1)))}
                >
                  −
                </Button>
                <span className="w-8 text-center tabular-nums">{weight(p.id)}</span>
                <Button
                  className="size-10 px-0"
                  aria-label={`More for ${p.name}`}
                  onClick={() => update((l) => void (l.weights[p.id] = weight(p.id) + 1))}
                >
                  +
                </Button>
              </div>
            </div>
          ))}
          <div className="flex">
            <Button variant="ghost" className="h-10 flex-1 text-sm" onClick={() => setShowWeights(false)}>
              Done
            </Button>
            {trailing}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Chip
            selected={everyone}
            onClick={() =>
              update((l) => {
                for (const p of participants) l.weights[p.id] = everyone ? 0 : Math.max(1, l.weights[p.id] ?? 0)
              })
            }
          >
            Everyone
          </Chip>
          {participants.map((p) => (
            <Chip
              key={p.id}
              selected={weight(p.id) > 0}
              onClick={() => update((l) => void (l.weights[p.id] = weight(p.id) > 0 ? 0 : 1))}
            >
              {p.name}
              {weight(p.id) > 1 && <span className="opacity-80">×{weight(p.id)}</span>}
            </Chip>
          ))}
          <button
            type="button"
            aria-label="Set shares"
            onClick={() => setShowWeights(true)}
            className="grid size-10 place-items-center rounded-full text-neutral-500 active:bg-neutral-100 dark:active:bg-neutral-800"
          >
            <Icon name="sliders" className="size-5" />
          </button>
          {trailing}
        </div>
      )}
    </>
  )
}

function AdjustmentFields({
  line,
  bill,
  result,
  autoFocus,
  update,
  trailing,
}: {
  line: AdjustmentLine
  bill: Bill
  result: LineResult | undefined
  autoFocus: boolean
  update: (recipe: (line: AdjustmentLine) => void) => void
  trailing: ReactNode
}) {
  const showAmount = line.mode === 'percent' && result?.amount != null
  return (
    <>
      <div className="flex gap-2">
        <div className="flex flex-1 items-center gap-2">
          <span className={cx('text-xl font-semibold', line.direction === 'add' ? 'text-neutral-500' : 'text-emerald-600')}>
            {line.direction === 'add' ? '+' : '−'}
          </span>
          <TextInput
            value={line.name}
            onChange={(e) => update((l) => void (l.name = e.target.value))}
            placeholder="Tip"
            autoFocus={autoFocus}
          />
        </div>
        <div className="relative w-32">
          <ExprInput
            value={line.value}
            onChange={(value) => update((l) => void (l.value = value))}
            placeholder="0"
            ariaLabel="Amount"
            inputClassName={line.mode === 'percent' ? 'pr-8' : undefined}
          />
          {line.mode === 'percent' && <span className="pointer-events-none absolute top-3 right-3 text-neutral-500">%</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Segmented
          className="flex-1"
          value={line.mode}
          options={[
            { value: 'fixed', label: 'Amount' },
            { value: 'percent', label: '%' },
          ]}
          onChange={(mode) => update((l) => void (l.mode = mode))}
        />
        <Segmented
          value={line.split}
          options={[
            { value: 'equal', label: 'Equal' },
            { value: 'proportional', label: 'By order' },
          ]}
          onChange={(split) => update((l) => void (l.split = split))}
          className="flex-1"
        />
        {trailing}
      </div>
      {showAmount && (
        <div className="text-sm text-neutral-500 tabular-nums">
          {line.direction === 'add' ? '+' : '−'}
          {formatMoney(Math.abs(result.amount ?? 0), bill.currency)} ({numericValue(line.value)}% of items)
        </div>
      )}
    </>
  )
}

function BillFooter({
  trip,
  bill,
  result,
  participants,
}: {
  trip: Trip
  bill: Bill
  result: BillResult
  participants: Person[]
}) {
  const balanced = result.status === 'balanced'
  return (
    <footer className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto max-w-xl px-4 pt-2 pb-2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-lg leading-tight font-semibold tabular-nums">
              {formatMoney(result.total, bill.currency)}
            </div>
            {result.homeTotalMinor !== null && (
              <div className="text-sm leading-tight text-neutral-500 tabular-nums">
                {formatMinor(result.homeTotalMinor, trip.homeCurrency)}
              </div>
            )}
          </div>
          <Pill tone={balanced ? 'ok' : 'warn'}>{billStatusLabel[result.status]}</Pill>
          <Button
            variant="primary"
            className="h-10"
            disabled={!balanced}
            onClick={() => navigate(paths.summary(trip.id, bill.id))}
          >
            {trip.splitwise ? 'Splitwise' : 'Summary'}
          </Button>
        </div>
        <div className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
          {participants.map((p) => (
            <div key={p.id} className="shrink-0 rounded-lg bg-neutral-100 px-3 py-1 dark:bg-neutral-800">
              <div className="text-xs text-neutral-500">{p.name}</div>
              <div className="text-sm font-medium whitespace-nowrap tabular-nums">
                {result.homeSharesMinor
                  ? formatMinor(result.homeSharesMinor[p.id] ?? 0, trip.homeCurrency)
                  : formatMoney(result.localShares[p.id] ?? 0, bill.currency)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </footer>
  )
}
