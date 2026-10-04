import { useState } from 'react'
import { Button, Card, copyText, cx, Icon, Section } from '../components/ui'
import { balancesText, tripBalances } from '../domain/balances'
import { formatMinor } from '../domain/format'
import type { Trip } from '../domain/types'
import { paths } from '../router'

/** Who's up and who's down across the whole trip, and the payments that settle it. */
export function BalancesTab({ trip }: { trip: Trip }) {
  const balances = tripBalances(trip)
  const name = (id: string) => trip.people.find((p) => p.id === id)?.name ?? 'Removed person'
  const money = (minor: number) => formatMinor(minor, trip.homeCurrency)

  if (balances.countedBills === 0) {
    return <p className="py-8 text-center text-neutral-500">Balances appear here once a bill is complete.</p>
  }

  return (
    <>
      {balances.pending.length > 0 && (
        <Card className="mb-4 border-amber-400 bg-amber-50 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          Not counted yet:{' '}
          {balances.pending.map((bill, i) => (
            <span key={bill.id}>
              {i > 0 && ', '}
              <a className="underline" href={paths.bill(trip.id, bill.id)}>
                {bill.name || 'Untitled bill'}
              </a>
            </span>
          ))}
        </Card>
      )}

      <Section title="Settle up">
        {balances.transfers.length === 0 ? (
          <Card className="text-center font-medium text-emerald-700 dark:text-emerald-400">Everyone is even ✓</Card>
        ) : (
          <Card className="divide-y divide-neutral-200 py-0 dark:divide-neutral-800">
            {balances.transfers.map((t) => (
              <div key={`${t.from}-${t.to}`} className="flex min-h-14 items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{name(t.from)}</span>
                  <span className="text-neutral-500"> pays </span>
                  <span className="font-medium">{name(t.to)}</span>
                </div>
                <span className="font-semibold tabular-nums">{money(t.amountMinor)}</span>
              </div>
            ))}
          </Card>
        )}
        {trip.splitwise && (
          <p className="mt-2 text-sm text-neutral-500">Using Splitwise? It works this out too once the bills are in.</p>
        )}
      </Section>

      <Section title="By person">
        <Card className="divide-y divide-neutral-200 py-0 dark:divide-neutral-800">
          {balances.people.map((p) => (
            <div key={p.id} className="flex min-h-14 items-center gap-2 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{name(p.id)}</div>
                <div className="text-xs text-neutral-500 tabular-nums">
                  Paid {money(p.paidMinor)} · Share {money(p.shareMinor)}
                </div>
              </div>
              <span
                className={cx(
                  'font-semibold tabular-nums',
                  p.netMinor > 0 && 'text-emerald-700 dark:text-emerald-400',
                  p.netMinor < 0 && 'text-red-600 dark:text-red-400',
                )}
              >
                {p.netMinor > 0 ? `gets ${money(p.netMinor)}` : p.netMinor < 0 ? `owes ${money(-p.netMinor)}` : 'even'}
              </span>
            </div>
          ))}
        </Card>
      </Section>

      <ShareButton text={balancesText(trip, balances)} />
    </>
  )
}

/** Opens the phone's share sheet, or copies to the clipboard where sharing isn't available. */
function ShareButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      className="w-full"
      onClick={async () => {
        if (navigator.share) {
          try {
            await navigator.share({ text })
          } catch {
            // Cancelled by the user.
          }
          return
        }
        await copyText(text)
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }}
    >
      <Icon name={copied ? 'check' : 'share'} className="size-5" /> {copied ? 'Copied' : 'Share summary'}
    </Button>
  )
}
