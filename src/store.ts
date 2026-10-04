import { produce } from 'immer'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { demoTrip } from './demo'
import { numericValue } from './domain/expr'
import { newId, today } from './domain/format'
import { migrate } from './domain/migrate'
import { type AppData, type Bill, DATA_VERSION, type Id, type Trip, type Withdrawal } from './domain/types'

interface Store {
  data: AppData
  /** Applies an immer recipe to the whole app state. */
  mutate: (recipe: (draft: AppData) => void) => void
  replaceData: (data: AppData) => void
}

export const useStore = create<Store>()(
  persist(
    (set) => ({
      data: { version: DATA_VERSION, trips: [] },
      mutate: (recipe) => set((state) => ({ data: produce(state.data, recipe) })),
      replaceData: (data) => set({ data }),
    }),
    {
      name: 'bill-splitter',
      version: DATA_VERSION,
      partialize: (state) => ({ data: state.data }),
      migrate: (persisted) => ({ data: migrate((persisted as { data: unknown }).data) }),
    },
  ),
)

export function useTrip(tripId: Id): Trip | undefined {
  return useStore((s) => s.data.trips.find((t) => t.id === tripId))
}

export function findTrip(draft: AppData, tripId: Id): Trip {
  const trip = draft.trips.find((t) => t.id === tripId)
  if (!trip) throw new Error(`Trip ${tripId} not found`)
  return trip
}

export function findBill(draft: AppData, tripId: Id, billId: Id): Bill {
  const bill = findTrip(draft, tripId).bills.find((b) => b.id === billId)
  if (!bill) throw new Error(`Bill ${billId} not found`)
  return bill
}

export function mutateTrip(tripId: Id, recipe: (trip: Trip) => void) {
  useStore.getState().mutate((d) => recipe(findTrip(d, tripId)))
}

export function mutateBill(tripId: Id, billId: Id, recipe: (bill: Bill, trip: Trip) => void) {
  useStore.getState().mutate((d) => recipe(findBill(d, tripId, billId), findTrip(d, tripId)))
}

export function createTrip(name: string, currency: string, homeCurrency: string, names: string[]): Id {
  const trip: Trip = {
    id: newId(),
    name,
    currency,
    homeCurrency,
    people: names.map((n) => ({ id: newId(), name: n })),
    withdrawals: [],
    bills: [],
    splitwise: false,
    createdAt: new Date().toISOString(),
  }
  useStore.getState().mutate((d) => {
    d.trips.unshift(trip)
  })
  return trip.id
}

/** The most recent withdrawal in a currency with a usable rate. */
export function latestWithdrawal(trip: Trip, currency: string): Withdrawal | undefined {
  return trip.withdrawals
    .map((w, index) => ({ w, index }))
    .filter(({ w }) => w.currency === currency && withdrawalRate(w) !== null)
    .sort((a, b) => b.w.date.localeCompare(a.w.date) || b.index - a.index)[0]?.w
}

export function withdrawalRate(w: Withdrawal): number | null {
  const local = numericValue(w.local)
  const home = numericValue(w.home)
  return local && home && local > 0 && home > 0 ? local / home : null
}

/** Rate expression for a cash bill, e.g. "200/173.4", so the maths stays visible. */
export function rateExpression(w: Withdrawal): string {
  return `${numericValue(w.local)}/${numericValue(w.home)}`
}

export function createBill(tripId: Id): Id {
  const id = newId()
  mutateTrip(tripId, (trip) => {
    const previous = trip.bills[0]
    const payerId =
      previous?.payerId && trip.people.some((p) => p.id === previous.payerId) ? previous.payerId : (trip.people[0]?.id ?? null)
    const currency = trip.currency
    const withdrawal = latestWithdrawal(trip, currency)
    const payment: Bill['payment'] =
      previous?.payment.type === 'card'
        ? { type: 'card', charged: '' }
        : { type: 'cash', rate: withdrawal ? rateExpression(withdrawal) : '' }
    trip.bills.unshift({
      id,
      name: '',
      date: today(),
      payerId,
      currency,
      participantIds: trip.people.map((p) => p.id),
      payment,
      lines: [],
      entered: null,
      createdAt: new Date().toISOString(),
    })
  })
  return id
}

export function removePerson(tripId: Id, personId: Id) {
  mutateTrip(tripId, (trip) => {
    trip.people = trip.people.filter((p) => p.id !== personId)
    for (const bill of trip.bills) {
      bill.participantIds = bill.participantIds.filter((id) => id !== personId)
      if (bill.payerId === personId) bill.payerId = null
      for (const line of bill.lines) if (line.kind === 'item') delete line.weights[personId]
    }
  })
}

/** Adds a fresh copy of the demo trip without touching existing trips. */
export function addDemoTrip(): Id {
  const trip = demoTrip()
  useStore.getState().mutate((d) => {
    d.trips.unshift(trip)
  })
  return trip.id
}
