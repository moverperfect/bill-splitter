import { type AppData, DATA_VERSION, type Trip } from './types'

/**
 * Upgrades stored or imported data to the current format. Each step takes one
 * version to the next, so old backups keep working.
 */
export function migrate(value: unknown): AppData {
  if (typeof value !== 'object' || value === null || !Array.isArray((value as { trips?: unknown }).trips)) {
    throw new Error('Not a Bill Splitter backup')
  }
  let data = value as { version: unknown; trips: unknown[] }
  if (data.version === 1) data = v1ToV2(data)
  if (data.version !== DATA_VERSION) throw new Error(`Unsupported backup version ${String(data.version)}`)
  return data as AppData
}

/** v2 added per-trip Splitwise mode. Trips from v1 were all used with Splitwise, so keep it on. */
function v1ToV2(data: { trips: unknown[] }): { version: 2; trips: Trip[] } {
  return { version: 2, trips: (data.trips as Omit<Trip, 'splitwise'>[]).map((trip) => ({ ...trip, splitwise: true })) }
}
