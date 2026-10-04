# Data format

Bill Splitter stores everything in the browser's `localStorage` under the key `bill-splitter`. **⋯ → Export backup** saves the same data as a JSON file, which **Import backup** reads back in. The types live in [`src/domain/types.ts`](../src/domain/types.ts).

## Versioning

Every backup has a top-level `version`. When the format changes:

1. Bump `DATA_VERSION` in `types.ts`.
2. Add a step to [`src/domain/migrate.ts`](../src/domain/migrate.ts) that upgrades the previous version.
3. Add a test in `migrate.test.ts`.

Saved data and imported backups both go through `migrate`, so older files keep working.

| Version | Change |
| ------- | ------ |
| 1 | First release. |
| 2 | Added `trip.splitwise`. Trips from v1 are migrated with it set to `true`. |

## Shape (v2)

```jsonc
{
  "version": 2,
  "trips": [
    {
      "id": "…",
      "name": "Albania (demo)",
      "people": [{ "id": "p1", "name": "Alex" }],
      "currency": "ALL",            // default currency for new bills
      "homeCurrency": "GBP",        // what everyone settles up in
      "splitwise": false,           // Splitwise copy buttons and entered/changed tracking
      "createdAt": "2026-09-01T10:00:00.000Z",
      "withdrawals": [
        // A cash withdrawal; local ÷ home gives the cash rate.
        { "id": "w1", "date": "2026-09-01", "currency": "ALL", "local": "40000", "home": "384.27" }
      ],
      "bills": [
        {
          "id": "b1",
          "name": "Dinner in Tirana",
          "date": "2026-09-01",
          "currency": "ALL",
          "payerId": "p1",
          "participantIds": ["p1"],
          // or { "type": "card", "charged": "29.64" }, the home-currency amount charged
          "payment": { "type": "cash", "rate": "40000/384.27" },
          "lines": [
            // weights: share units per person; missing or 0 means they didn't have it
            { "id": "l1", "kind": "item", "name": "Lager", "cost": "2×225", "weights": { "p1": 2 } },
            {
              "id": "l2", "kind": "adjustment", "name": "Tip",
              "direction": "add",            // or "subtract" for discounts
              "mode": "fixed",               // or "percent" of the item subtotal
              "value": "600",
              "split": "equal"               // or "proportional" to each person's items
            }
          ],
          "entered": null,                   // Splitwise mode: { enteredAt, totalMinor, sharesMinor }
          "createdAt": "2026-09-01T20:00:00.000Z"
        }
      ]
    }
  ]
}
```

Amount fields (`cost`, `value`, `rate`, `charged`, `local`, `home`) are stored as the text the user typed, which may be a sum such as `2×225`. They're evaluated when needed, so a typo can be fixed later without losing what was entered. Computed amounts (`totalMinor`, `sharesMinor`) are integers in the home currency's minor unit: pence for GBP, whole yen for JPY.
