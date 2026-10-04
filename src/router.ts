import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'trips' }
  | { name: 'trip'; tripId: string; tab: TripTab }
  | { name: 'bill'; tripId: string; billId: string }
  | { name: 'summary'; tripId: string; billId: string }

export type TripTab = 'bills' | 'balances' | 'cash' | 'trip'

const TABS: TripTab[] = ['bills', 'balances', 'cash', 'trip']

// Hash routing keeps static hosting and the offline service worker simple.
export function parseRoute(hash: string): Route {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (parts[0] === 'trip' && parts[1]) {
    const tripId = parts[1]
    if (parts[2] === 'bill' && parts[3]) {
      // "splitwise" is the v1 path, kept so old links and home-screen state still land somewhere.
      return parts[4] === 'summary' || parts[4] === 'splitwise'
        ? { name: 'summary', tripId, billId: parts[3] }
        : { name: 'bill', tripId, billId: parts[3] }
    }
    const tab = TABS.find((t) => t === parts[2]) ?? 'bills'
    return { name: 'trip', tripId, tab }
  }
  return { name: 'trips' }
}

export const paths = {
  trips: () => '#/',
  trip: (tripId: string, tab: TripTab = 'bills') => (tab === 'bills' ? `#/trip/${tripId}` : `#/trip/${tripId}/${tab}`),
  bill: (tripId: string, billId: string) => `#/trip/${tripId}/bill/${billId}`,
  summary: (tripId: string, billId: string) => `#/trip/${tripId}/bill/${billId}/summary`,
}

export function navigate(path: string, { replace = false } = {}) {
  if (replace) window.location.replace(path)
  else window.location.hash = path
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseRoute(hash)
}
