import { useEffect } from 'react'
import { CurrencyList } from './components/CurrencyInput'
import { useRoute } from './router'
import { BillScreen } from './screens/BillScreen'
import { SummaryScreen } from './screens/SummaryScreen'
import { TripScreen } from './screens/TripScreen'
import { TripsScreen } from './screens/TripsScreen'

export function App() {
  const route = useRoute()
  const key = JSON.stringify(route)

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll to top whenever the route changes
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [key])

  return (
    <>
      <RouteScreen />
      <CurrencyList />
    </>
  )
}

function RouteScreen() {
  const route = useRoute()
  switch (route.name) {
    case 'trips':
      return <TripsScreen />
    case 'trip':
      return <TripScreen tripId={route.tripId} tab={route.tab} />
    case 'bill':
      return <BillScreen key={route.billId} tripId={route.tripId} billId={route.billId} />
    case 'summary':
      return <SummaryScreen tripId={route.tripId} billId={route.billId} />
  }
}
