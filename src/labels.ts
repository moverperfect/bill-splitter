import { currencySymbol } from './domain/currency'
import type { BillStatus, LineIssue } from './domain/split'

export const billStatusLabel: Record<BillStatus, string> = {
  'add-items': 'Add items',
  'check-lines': 'Check lines',
  'pick-payer': 'Pick who paid',
  'check-total': 'Check total',
  'add-rate': 'Add rate',
  'add-charged': 'Add amount charged',
  'check-rate': 'Check rate',
  balanced: 'Balanced',
}

export const lineIssueLabel: Record<LineIssue, string> = {
  'add-cost': 'Add cost',
  'check-cost': 'Check cost',
  'assign-people': 'Assign people',
  'add-amount': 'Add amount',
  'check-amount': 'Check amount',
  'nothing-to-split': 'No items to split against',
}

/** e.g. "£ charged", "$ charged" or "CHF charged". */
export function chargedLabel(homeCurrency: string): string {
  return `${currencySymbol(homeCurrency)} charged`
}
