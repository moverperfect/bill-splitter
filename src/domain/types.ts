export type Id = string

export interface Person {
  id: Id
  name: string
}

/** A cash withdrawal (or any known conversion) that fixes a rate for later cash bills. */
export interface Withdrawal {
  id: Id
  date: string
  currency: string
  /** Local currency received, as an expression, e.g. "200". */
  local: string
  /** Home currency debited including fees, as an expression, e.g. "173.40". */
  home: string
}

export interface ItemLine {
  id: Id
  kind: 'item'
  name: string
  /** Cost in the bill's currency, as an expression, e.g. "2×350". */
  cost: string
  /** Share units per person. Missing or 0 means they didn't have it; 2 means a double share. */
  weights: Record<Id, number>
}

/** A tip, service charge or discount applied across the bill. */
export interface AdjustmentLine {
  id: Id
  kind: 'adjustment'
  name: string
  direction: 'add' | 'subtract'
  mode: 'fixed' | 'percent'
  /** Fixed amount in the bill's currency, or a percentage of the item subtotal. */
  value: string
  split: 'equal' | 'proportional'
}

export type Line = ItemLine | AdjustmentLine

export type Payment =
  /** Rate is local units per 1 home unit, as an expression, e.g. "200/173.40". */
  | { type: 'cash'; rate: string }
  /** Home currency charged by the card, as an expression, e.g. "29.64". */
  | { type: 'card'; charged: string }

/** What was typed into Splitwise, so later edits can be flagged. */
export interface SplitwiseSnapshot {
  enteredAt: string
  totalMinor: number
  sharesMinor: Record<Id, number>
}

export interface Bill {
  id: Id
  name: string
  date: string
  payerId: Id | null
  currency: string
  participantIds: Id[]
  payment: Payment
  lines: Line[]
  /** Splitwise mode only: what was last entered there. */
  entered: SplitwiseSnapshot | null
  createdAt: string
}

export interface Trip {
  id: Id
  name: string
  people: Person[]
  currency: string
  homeCurrency: string
  withdrawals: Withdrawal[]
  bills: Bill[]
  /** Show Splitwise copy buttons and entered/changed tracking. */
  splitwise: boolean
  createdAt: string
}

export const DATA_VERSION = 2

/** Everything the app stores, and the export/backup file format. See docs/data-format.md. */
export interface AppData {
  version: typeof DATA_VERSION
  trips: Trip[]
}
