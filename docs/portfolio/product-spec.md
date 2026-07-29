# Product Specification: Investment Portfolio

Status: implementation in progress

Owner: Spending Tracker

Last reviewed: 2026-07-29

## 1. Problem

The application tracks bank balances, income, expenses, and transfers, but it
cannot represent money held in stocks, ETFs, or cryptocurrencies. Recording a
purchase as an expense produces incorrect spending analytics, while recording
the security as a bank account loses quantity, price, and performance data.

The portfolio feature must add investment tracking without weakening the
existing cash ledger.

## 2. Product outcome

The user can maintain a trustworthy personal net-worth view across bank
accounts and investments while keeping spending analytics independent from
investment activity.

### Success measures

- A position created from an opening balance or trade history shows the expected
  quantity and weighted-average cost.
- A buy or sell changes investment cash and holdings atomically.
- An investment transfer never appears as income or spending.
- Portfolio totals identify the quote timestamp and reporting currency.
- All portfolio records survive backup and restore.
- With a cached or manual quote, the portfolio remains usable when the external
  provider is unavailable.

## 3. Assumptions

- The application remains single-user during the MVP.
- `PYG` is the initial reporting currency, but it is configurable.
- One investment account tracks one cash currency in the MVP. A user can create
  separate investment accounts for different cash currencies.
- Prices are informational and may be delayed. This application is not an
  execution or trading system.
- The user is responsible for entering complete and accurate transactions.

## 4. Personas and primary journeys

### Existing investor

The user already owns investments and wants to start tracking without recreating
every historical cash movement.

Journey:

1. Create an investment account.
2. Add an asset manually or through provider search.
3. Record an opening position with quantity, unit cost, date, and historical FX
   rate when applicable.
4. Fetch or enter a current price.
5. Review market value and unrealized result.

### Ongoing investor

The user wants new activity to update portfolio cash, holdings, and performance.

Journey:

1. Transfer money from a bank account to investment cash.
2. Record a buy.
3. Later record dividends, fees, and a partial or full sale.
4. Review remaining cost basis and realized result.

### Crypto holder

The user wants fractional quantities and a wallet or exchange account.

Journey:

1. Create a wallet or exchange account.
2. Add a crypto asset such as `BTC/USD`.
3. Enter a high-precision opening position or trade.
4. Refresh a 24/7 quote or use a manual price.

## 5. Functional requirements

Requirements use stable identifiers so sprint tasks, tests, and release
evidence can reference the same behavior.

### FR-001: Reporting currency

- The user can configure one ISO 4217 reporting currency.
- The initial default is `PYG`.
- Bank and investment totals are converted before aggregation.
- A missing FX rate blocks the converted total for the affected value and shows
  an actionable warning. It must not silently assume a rate of `1`.
- Same-currency conversion always uses a rate of `1`.

### FR-010: Investment accounts

- The user can create, rename, and archive an account.
- Account types are `BROKERAGE`, `EXCHANGE`, and `WALLET`.
- An investment account has one cash currency.
- Each account has a linked investment-cash ledger.
- An account with activity cannot be hard-deleted from the normal interface.
  It can be archived.
- The account detail shows cash, positions, total value, and recent investment
  activity.

### FR-020: Asset catalog

- Asset types are `STOCK`, `ETF`, and `CRYPTO`.
- The user can search the configured provider and select a result.
- The user can create an asset manually when search is unavailable.
- An asset stores a normalized symbol, display name, market or exchange, quote
  currency, provider identifier, and active status.
- Assets are uniquely identified by asset type, normalized symbol, and market.
- Provider lookup never runs directly in the browser.

### FR-030: Opening positions

- The user can enter quantity, unit cost, acquisition date, fees, and optional
  notes.
- An opening position increases quantity and cost basis but does not modify
  bank or investment cash.
- Quantity and unit cost must be positive.
- The transaction stores the FX rate to reporting currency used for the
  historical base-currency cost.

### FR-040: Investment activity

The MVP transaction types are:

| Type | Quantity effect | Investment cash effect | Spending analytics |
|---|---:|---:|---|
| `OPENING_POSITION` | increase | none | excluded |
| `BUY` | increase | decrease by gross plus fees | excluded |
| `SELL` | decrease | increase by gross minus fees | excluded |
| `DIVIDEND` | none | increase by gross minus fees | excluded |
| `FEE` | none | decrease | excluded |

- A buy, sell, dividend, or fee and its cash effect are committed in one Prisma
  transaction.
- A sell cannot exceed the position quantity as of its transaction date.
- Transactions can be edited or deleted only by recalculating all affected
  later position state inside one database transaction.
- Editing historical activity cannot leave cash or cost basis partially
  updated.
- Dates are stored as UTC instants and displayed in the application timezone.

### FR-050: Funding and withdrawals

- The user can transfer money between a regular bank account and the linked
  investment cash account using the existing `TRANSFER` behavior.
- Funding and withdrawals are excluded from income and expense analytics.
- A transfer updates both cash balances atomically.
- The portfolio does not create a second copy of the same funding event.

### FR-060: Position calculations

For every investment account and asset, the application exposes:

- Quantity held.
- Weighted-average unit cost.
- Remaining cost basis in trade currency and reporting currency.
- Latest price and quote timestamp.
- Market value in quote currency and reporting currency.
- Realized gain or loss.
- Unrealized gain or loss.
- Dividends and fees.

Closed positions remain available in activity and performance history but are
hidden from the default open-position list.

### FR-070: Quotes and FX rates

- The server can refresh quotes for open positions.
- Quotes are persisted with provider, source timestamp, fetch timestamp, and
  currency.
- Manual prices and FX rates are supported.
- The UI distinguishes fresh, stale, unavailable, and manual values.
- Automatic refresh does not overwrite a locked manual value.
- External failures return a useful status while leaving the last valid cached
  value available.
- Refresh requests obey provider batching and quota limits.

### FR-080: Portfolio overview

The `/portfolio` route shows:

- Total investment value.
- Investment cash.
- Open cost basis.
- Realized and unrealized result.
- Allocation by asset type.
- Allocation by position.
- Account selector or account summary.
- Open positions.
- Quote freshness and refresh action.

The dashboard shows net worth as:

```text
converted regular bank cash
+ converted investment cash
+ converted open-position market value
```

Investment cash must be counted exactly once.

### FR-090: Navigation and responsive behavior

- Portfolio appears in the desktop sidebar.
- Mobile navigation keeps no more than five primary destinations.
- Categories and lower-frequency destinations move under a `More` destination
  when Portfolio is introduced.
- Forms are usable at a 320 CSS-pixel viewport without horizontal scrolling.
- Tables have a mobile card or scroll treatment.

### FR-100: Backup and restore

- CSV and Excel exports include investment accounts, assets, investment
  transactions, current manual values, and settings.
- Import validates references before deleting current data.
- Restore is atomic: either the complete supported dataset is restored or the
  existing data remains unchanged.
- External cached quotes may be omitted and fetched again, but manual quotes and
  FX rates must be preserved.
- The backup format includes a schema version.

## 6. Product rules

### Accounting separation

- `EXPENSE` means consumed value.
- `INCOME` means earned cash.
- `TRANSFER` moves cash without changing net worth.
- `BUY` and `SELL` exchange investment cash and an investment asset without
  being income or expense.
- A market-price change changes net worth but never changes cash.

### Precision

- Quantities accept up to 12 fractional digits.
- Prices, FX rates, and fees accept up to 8 fractional digits.
- Persistent calculations use decimal arithmetic.
- Rounding is applied only at display or external-export boundaries.

### Quote freshness

Initial defaults:

- Stocks and ETFs: stale after 30 minutes during the relevant market session,
  or after 24 hours when the market is closed.
- Crypto: stale after 15 minutes.
- FX: stale after 24 hours.
- Manual values: labeled manual rather than fresh or stale unless they have an
  explicit expiry.

These thresholds are product configuration, not database invariants.

## 7. Error and empty states

- No accounts: explain investment-account types and offer `Add account`.
- No positions: offer `Add opening position` and `Record buy`.
- Missing quote: show cost basis, identify the missing symbol, and offer refresh
  or manual price.
- Missing FX: show native-currency values, omit the invalid aggregate, and offer
  manual FX entry.
- Provider quota reached: retain cached values and state when another refresh
  can be attempted.
- Insufficient investment cash: reject a buy unless an explicit future
  setting permits negative cash.
- Oversell: reject with available quantity as of the selected date.

## 8. MVP exclusions

- Brokerage or exchange authentication and automatic trade synchronization.
- Tax advice, tax forms, and jurisdiction-specific tax-lot reporting.
- FIFO, LIFO, or specific-lot selection.
- Options, futures, bonds, mutual funds, staking, lending, and yield farming.
- Short selling, margin, leverage, and negative positions.
- Corporate actions other than manually entering an adjusted opening position.
- Live WebSocket streaming and order execution.
- Multi-user ownership, sharing, and permissions.
- Benchmark comparisons, time-weighted return, and money-weighted return.

## 9. Definition of done

A requirement is complete only when:

- Its acceptance behavior is visible through the application.
- Domain invariants have automated tests.
- Server actions validate malformed and unauthorized-by-state operations.
- Loading, empty, stale-data, and provider-error states are implemented.
- Data is included in backup and restore when applicable.
- `npm run lint`, type checking, tests, and production build pass.
- Documentation is updated when the implemented contract differs from this
  proposal.
