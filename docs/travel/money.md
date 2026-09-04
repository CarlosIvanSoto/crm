# Travel money — read before you touch a quote, booking, payment or rate

This product buys a trip from a supplier in one currency and sells it to the
customer in another. It is more multi-currency than the CRM, not less. The rules
are `docs/currency.md`'s rules, applied to two amounts per line instead of one.

## Two sides on every line

`QuoteItem` and `BookingItem` each carry:

- `costAmount` + `costCurrency` — what the agency pays the supplier.
- `sellAmount` + `sellCurrency` — what the customer pays the agency.
- `costBaseAmount`, `sellBaseAmount` (both `Decimal(24,4)`) + `baseCurrency`,
  `fxRate` (`Decimal(20,10)`), `fxRateAt`.

## Only the `*BaseAmount` columns may be summed

`_sum` over `sellAmount` adds pesos to dollars and prints a wrong total with no
error. Every total, chart, average and margin reads `sellBaseAmount` /
`costBaseAmount` only.

- **The rate is resolved once and frozen** when `amount` or `currency` changes.
  Converting on read makes a closed file's margin move every morning.
- **A missing rate is `null`, disclosed not zeroed.** It falls out of `_sum`
  automatically; count the null rows so the UI can say a line is not included.
- `margin = sellBaseAmount − costBaseAmount`. A derived read, not a column.
- `ExchangeRate` is copied from the CRM: `@@unique([baseCurrency,
  quoteCurrency, source])`, `MANUAL` beats `FETCHED`, `rate` is units of
  `baseCurrency` per unit of `quoteCurrency`.

## Payments

- `Payment` is a charge to the customer. The payment plan is the ordered set of
  `SCHEDULED` rows — there is no separate plan model.
- `SupplierPayment` is a payable to a supplier.
- **`OVERDUE` is not a stored status.** It is `status = SCHEDULED AND dueDate <
  now()`. A stored status needs a cron to keep it true and drifts the day the
  cron fails.

## Commissions

`Commission` is the advisor's cut of one booking. `basis` picks the base:

- `MARGIN` — `sellTotalBase − costTotalBase`. `SELL` — `sellTotalBase`. Both are
  already in base currency. `amountBase = basisBaseAmount × rate`. `fxRate` is
  `null`: no conversion happened.
- `FIXED` — the advisor types `amount` + `currency`. `ConversionService.itemFields`
  fills `amountBase`, `baseCurrency`, `fxRate`, `fxRateAt`, the same as a payment.

**The amount is frozen on create.** A later itinerary change does not move it. A
`recalculate` mutation re-reads the booking totals and re-freezes. This is
`docs/currency.md`'s "resolve once" rule applied to the advisor's pay.

**Only `amountBase` is summed.** A missing rate is `amountBase = null`, disclosed
with a `missingRate` count next to every total, never zeroed.

`status` runs `PENDING → APPROVED → PAID`, with `VOID` from any state. `markPaid`
only stamps `paidAt`; it does not write a cash-out row.

`canManageCommission` (admin or accountant) gates every write. An `agent` sees
only their own rows — the `userId` filter is set by the service, never an input.
`bookings` and `quotes` now null `sellTotalBase`, `costTotalBase` and
`marginBase` for a role without `canSeeMargins`.
