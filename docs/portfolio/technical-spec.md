# Technical Specification: Investment Portfolio

Status: implementation in progress

Last reviewed: 2026-07-29

Related: [product specification](./product-spec.md)

## 1. Current application constraints

The implementation must fit the existing architecture:

- Next.js 16 App Router and React 19.
- Prisma 6 with PostgreSQL.
- Server actions under `src/actions`.
- Zod and React Hook Form for input validation.
- Recharts for data visualization.
- Atomic balance changes through `prisma.$transaction`.
- `Decimal(24,8)` bank balances and `Decimal(12,2)` cash transactions.
- No user or authentication model.
- CSV and Excel backup can replace the complete local dataset.

Two current behaviors must be corrected or protected:

1. The dashboard adds account balances before considering account currency.
2. Income and expense analytics query only the existing `Transaction` ledger.

Portfolio work must make the first behavior currency-aware and preserve the
second behavior by keeping investment activity outside `INCOME` and `EXPENSE`.

## 2. Target architecture

```text
Browser
  |
  | server components and server actions
  v
Portfolio application service
  |-------------------|--------------------|
  v                   v                    v
Investment ledger   Quote/FX cache       Existing cash ledger
  |                   |                    |
  v                   v                    v
PostgreSQL          Provider adapter     BankAccount + Transaction
                          |
                          v
                     Twelve Data
```

Core rule: portfolio calculations read local PostgreSQL state. A page render
does not require a live market-data request.

## 3. Domain model

The following is a logical specification. The implementation may adjust Prisma
relation names, but field meaning and invariants must remain stable.

### 3.1 Application settings

`AppSettings` is a singleton while the application is single-user.

| Field | Type | Rule |
|---|---|---|
| `id` | `String` | Fixed singleton identifier |
| `reportingCurrency` | `String` | ISO 4217; default `PYG` |
| `timezone` | `String` | Default `America/Asuncion` |
| `createdAt` | `DateTime` | Server generated |
| `updatedAt` | `DateTime` | Prisma managed |

If user accounts are introduced later, these settings move to a user-owned
relation.

### 3.2 Bank-account classification

Add `BankAccountKind`:

```text
STANDARD
INVESTMENT_CASH
```

Add `kind BankAccountKind @default(STANDARD)` to `BankAccount`.

`INVESTMENT_CASH` records:

- Are linked one-to-one to an `InvestmentAccount`.
- Reuse the existing bank-transfer ledger.
- Are not offered as ordinary accounts in forms that create income or expenses.
- Are offered as transfer destinations through the investment funding flow.
- Cannot be deleted through `deleteAccount`.

Widen `BankAccount.balance` from `Decimal(12,2)` to `Decimal(24,8)` before
creating investment cash accounts. This is an additive precision change for
existing values. Ordinary bank forms and currency formatting keep their current
zero- or two-decimal behavior, while portfolio cash effects retain sufficient
precision.

This design reuses the current atomic `TRANSFER` behavior for portfolio funding
and avoids duplicating cash balances in the investment domain.

### 3.3 Investment account

```text
enum InvestmentAccountType {
  BROKERAGE
  EXCHANGE
  WALLET
}
```

| Field | Type | Rule |
|---|---|---|
| `id` | `String` | CUID primary key |
| `name` | `String` | Required, trimmed |
| `type` | enum | Brokerage, exchange, or wallet |
| `cashCurrency` | `String` | ISO 4217 |
| `cashAccountId` | `String` | Unique relation to `BankAccount` |
| `archivedAt` | `DateTime?` | Archive instead of deleting activity |
| `createdAt` | `DateTime` | Server generated |
| `updatedAt` | `DateTime` | Prisma managed |

Creation must atomically create both the investment account and its linked
`INVESTMENT_CASH` bank account.

### 3.4 Asset

```text
enum AssetType {
  STOCK
  ETF
  CRYPTO
}
```

| Field | Type | Rule |
|---|---|---|
| `id` | `String` | CUID primary key |
| `type` | enum | Stock, ETF, or crypto |
| `symbol` | `String` | Uppercase normalized symbol |
| `name` | `String` | Display name |
| `market` | `String` | Exchange/MIC or normalized crypto market |
| `quoteCurrency` | `String` | ISO currency used by prices |
| `provider` | `String?` | Null for manual-only asset |
| `providerSymbol` | `String?` | Exact external identifier |
| `active` | `Boolean` | Defaults true |
| timestamps | `DateTime` | Created and updated |

Constraints:

- Unique on `(type, symbol, market)`.
- Unique on `(provider, providerSymbol)` when both values are present.
- A manual stock or ETF requires a market value.
- A crypto provider symbol stores the pair expected by the provider, for
  example `BTC/USD`, rather than assuming that `BTC` is globally unique.

### 3.5 Investment transaction

```text
enum InvestmentTransactionType {
  OPENING_POSITION
  BUY
  SELL
  DIVIDEND
  FEE
}
```

| Field | Type | Rule |
|---|---|---|
| `id` | `String` | CUID primary key |
| `clientRequestId` | `String` | Unique idempotency key |
| `accountId` | `String` | Required investment account |
| `assetId` | `String?` | Required except account-level fee |
| `type` | enum | See cash-effect table |
| `quantity` | `Decimal(30,12)?` | Required for opening, buy, and sell |
| `unitPrice` | `Decimal(24,8)?` | Required for opening, buy, and sell |
| `cashAmount` | `Decimal(24,8)?` | Positive gross cash amount |
| `fees` | `Decimal(24,8)` | Positive; defaults zero |
| `currency` | `String` | Transaction currency |
| `fxRateToReporting` | `Decimal(24,10)` | Historical conversion rate |
| `date` | `DateTime` | Effective date |
| `notes` | `String?` | User note |
| timestamps | `DateTime` | Created and updated |

For `BUY` and `SELL`, the server computes and persists:

```text
cashAmount = quantity * unitPrice
```

The client cannot submit a conflicting gross value.

Cash effects:

| Type | Linked investment cash delta |
|---|---:|
| `OPENING_POSITION` | `0` |
| `BUY` | `-(cashAmount + fees)` |
| `SELL` | `cashAmount - fees` |
| `DIVIDEND` | `cashAmount - fees` |
| `FEE` | `-cashAmount` |

Database constraints alone cannot express every type-dependent condition.
Server validation and automated tests enforce them.

Indexes:

- `(accountId, date, createdAt)`
- `(assetId, date, createdAt)`
- `(accountId, assetId)`
- Unique `clientRequestId`

The stable replay order is `date`, then `createdAt`, then `id`.

### 3.6 Market quote

```text
enum MarketDataSource {
  TWELVE_DATA
  MANUAL
}
```

| Field | Type | Rule |
|---|---|---|
| `id` | `String` | CUID primary key |
| `assetId` | `String` | Asset relation |
| `source` | enum | Provider or manual |
| `price` | `Decimal(24,8)` | Must be positive |
| `currency` | `String` | Must match or explicitly convert to asset quote currency |
| `asOf` | `DateTime` | Provider or user value time |
| `fetchedAt` | `DateTime` | Server retrieval time |
| `active` | `Boolean` | Manual override can be deactivated |

Unique on `(assetId, source)`.

Effective quote selection:

1. Active manual quote.
2. Latest valid provider quote.
3. Latest transaction unit price, labeled as fallback.
4. Unavailable.

Provider refresh upserts only the provider row, so it never overwrites a manual
row.

### 3.7 Exchange rate

| Field | Type | Rule |
|---|---|---|
| `id` | `String` | CUID primary key |
| `fromCurrency` | `String` | Source ISO currency |
| `toCurrency` | `String` | Reporting ISO currency |
| `source` | enum | Provider or manual |
| `rate` | `Decimal(24,10)` | Positive |
| `asOf` | `DateTime` | Source timestamp |
| `fetchedAt` | `DateTime` | Retrieval timestamp |
| `active` | `Boolean` | Manual override state |

Unique on `(fromCurrency, toCurrency, source)`.

Conversions always state their direction:

```text
reporting amount = source amount * rate(fromCurrency -> reportingCurrency)
```

Do not infer or invert a missing pair silently. An explicit helper may invert a
known reciprocal rate using decimal arithmetic.

### 3.8 Daily portfolio snapshot

Snapshots are introduced after the current-value MVP.

| Field | Type |
|---|---|
| `id` | `String` |
| `accountId` | `String` |
| `date` | `DateTime` normalized to reporting day |
| `cashValueReporting` | `Decimal(24,8)` |
| `holdingsValueReporting` | `Decimal(24,8)` |
| `totalValueReporting` | `Decimal(24,8)` |
| `reportingCurrency` | `String` |

Unique on `(accountId, date)`.

## 4. Calculation specification

Calculations belong in pure functions under
`src/lib/portfolio/calculations.ts`. They accept domain DTOs with Prisma
decimals converted to a deliberate decimal type, not JavaScript binary floats.

Portfolio forms use a dedicated decimal parser. The current
`parseAmountInput` helper caps input at two fractional digits and must not parse
investment quantities, prices, fees, or FX rates.

### 4.1 Replay state

For each `(investmentAccount, asset)` pair, replay transactions in stable order
and maintain:

```text
quantity
remainingCostNative
remainingCostReporting
realizedGainNative
realizedGainReporting
dividendsNative
dividendsReporting
feesNative
feesReporting
```

### 4.2 Opening position and buy

```text
gross = quantity * unitPrice
added native cost = gross + fees
added reporting cost = added native cost * fxRateToReporting

new quantity = old quantity + quantity
new remaining native cost = old remaining native cost + added native cost
new remaining reporting cost =
  old remaining reporting cost + added reporting cost
```

`OPENING_POSITION` has the same position effect but no investment-cash effect.

### 4.3 Sell

Before applying:

```text
sell quantity > 0
sell quantity <= current quantity
```

Then:

```text
native average cost = remainingCostNative / current quantity
reporting average cost = remainingCostReporting / current quantity

allocated native cost = native average cost * sell quantity
allocated reporting cost = reporting average cost * sell quantity

native proceeds = quantity * unitPrice - fees
reporting proceeds = native proceeds * fxRateToReporting

realized gain native = native proceeds - allocated native cost
realized gain reporting = reporting proceeds - allocated reporting cost
```

Subtract the allocated costs and sold quantity. If the remaining quantity is
zero, force both remaining costs to exact zero to avoid decimal residue.

### 4.4 Current value

```text
market value native = open quantity * effective quote price
market value reporting =
  market value native * current FX rate to reporting currency

unrealized gain reporting =
  market value reporting - remainingCostReporting
```

This intentionally includes currency movement in reporting-currency
performance.

### 4.5 Portfolio totals

```text
portfolio value =
  converted linked investment cash
  + sum(converted open-position market value)

net worth =
  sum(converted STANDARD bank balances)
  + sum(portfolio values)
```

Because investment cash is a `BankAccount`, aggregate queries must either:

- Exclude `INVESTMENT_CASH` from regular bank totals and include it through
  portfolio totals; or
- Include all bank cash once and add only investment holdings.

The implementation must choose one query path consistently. The recommended
presentation is the first option because it produces separate Bank and
Investment cards.

## 5. Mutation behavior

All mutations:

- Parse a typed object with Zod.
- Confirm referenced records and state.
- Use a single `prisma.$transaction` when balances or multiple records change.
- Perform cash and position validation inside a serializable transaction so two
  concurrent buys or sells cannot both pass against the same prior state.
- Retry a serialization conflict a small bounded number of times using the same
  idempotency key.
- Return serializable DTOs rather than Prisma `Decimal` instances.
- Revalidate `/`, `/accounts`, `/transactions`, `/portfolio`, and the affected
  detail route when relevant.

### Create investment account

```text
createInvestmentAccount(input)
  -> validate name, type, currency, optional opening cash
  -> transaction:
       create linked BankAccount(kind=INVESTMENT_CASH)
       create InvestmentAccount(cashAccountId=...)
  -> revalidate
```

### Record investment transaction

```text
recordInvestmentTransaction(input)
  -> transaction at serializable isolation:
       return prior success for same clientRequestId and equivalent input
       reject same clientRequestId with conflicting input
       load account, linked cash account, asset, and complete affected ledger
       normalize cashAmount
       replay proposed ledger and reject any negative position
       create investment transaction
       increment/decrement linked cash balance when applicable, rejecting an
       insufficient balance with a conditional update
  -> revalidate
```

Negative investment cash is rejected in the MVP.

### Update or delete investment transaction

```text
update/delete
  -> load original record and affected ledger
  -> calculate original cash effect
  -> calculate proposed replacement cash effect
  -> replay the complete proposed ledger
  -> transaction:
       apply only cash-effect delta
       update/delete ledger record
  -> revalidate
```

This supports backdated edits without silently allowing a later oversell.

### Archive investment account

- Reject new activity after archival.
- Keep positions and history readable.
- Do not delete the linked cash account or transactions.
- Require zero open positions and zero cash before a future hard-delete
  maintenance operation.

## 6. Read services

Recommended server-only read functions:

```ts
getPortfolioOverview(): Promise<PortfolioOverviewDto>
getInvestmentAccounts(options?): Promise<InvestmentAccountSummaryDto[]>
getInvestmentAccount(id: string): Promise<InvestmentAccountDetailDto | null>
getInvestmentActivity(options): Promise<InvestmentActivityDto[]>
getEffectiveQuotes(assetIds: string[]): Promise<EffectiveQuoteDto[]>
getRequiredFxRates(currencies: string[]): Promise<EffectiveFxRateDto[]>
```

DTOs return `number` only at the final UI boundary. Internal calculations stay
decimal. Each converted total includes:

```ts
{
  value: number | null;
  currency: string;
  complete: boolean;
  missingRates: string[];
  missingQuotes: string[];
}
```

An incomplete total is never displayed as if it were complete.

## 7. Market-data integration

### Provider interface

```ts
interface MarketDataProvider {
  searchAssets(query: string, type?: AssetType): Promise<AssetSearchResult[]>;
  getQuotes(assets: ProviderAssetRef[]): Promise<ProviderQuote[]>;
  getExchangeRates(pairs: CurrencyPair[]): Promise<ProviderExchangeRate[]>;
}
```

Implementation location:

```text
src/lib/market-data/types.ts
src/lib/market-data/provider.ts
src/lib/market-data/twelve-data.ts
src/lib/market-data/errors.ts
```

### Provider choice

Twelve Data is the first adapter because one API covers US stocks, ETFs,
cryptocurrencies, and FX. As reviewed on 2026-07-28, its Basic plan documents
8 API credits per minute and 800 per day, including real-time US equities,
ETFs, and crypto for internal/non-display usage:

- <https://twelvedata.com/pricing>
- <https://twelvedata.com/docs>

The provider is an implementation detail, not a domain identifier. A second
adapter can be added without migrating investment transactions.

Public display or commercial deployment requires a fresh licensing review.

### Refresh policy

Refresh only assets held in open positions:

1. Read open asset identifiers.
2. Exclude active manual quotes.
3. Exclude provider quotes that are still fresh.
4. Group requests within provider limits.
5. Fetch through a server-only adapter with timeout.
6. Validate symbol, positive price, currency, and timestamp.
7. Upsert all valid results in one transaction.
8. Return per-symbol successes and failures.

Do not erase the last valid quote on provider failure.

### Trigger paths

- User action: `refreshPortfolioQuotes()`.
- Protected route: `POST /api/cron/portfolio-quotes`.
- Future scheduler: call the protected route, never a server action URL.

Environment:

```text
MARKET_DATA_PROVIDER=twelve-data
TWELVE_DATA_API_KEY=...
PORTFOLIO_REFRESH_SECRET=...
MARKET_DATA_TIMEOUT_MS=8000
```

The refresh route checks `Authorization: Bearer <PORTFOLIO_REFRESH_SECRET>`.
Secrets are read only from server modules.

### Resilience

- Use an abort timeout.
- Do not automatically retry `4xx` validation or quota failures.
- Retry one transient timeout or `5xx` only when the request is idempotent and
  quota impact is acceptable.
- Log provider, endpoint class, status, duration, requested count, and successful
  count. Never log credentials or full authorization headers.

## 8. Routes and components

### Routes

```text
/portfolio
/portfolio/accounts/[accountId]
/more
/api/cron/portfolio-quotes
```

An asset-detail route and performance-history route are post-MVP.

### Server components

- `/portfolio` loads accounts, positions, quotes, FX, and aggregate results in
  parallel where dependencies permit.
- Account detail loads one account, positions, and paginated activity.
- Pages remain `force-dynamic` in line with the existing dashboard.

### Client components

```text
src/components/portfolio/investment-account-form.tsx
src/components/portfolio/asset-search.tsx
src/components/portfolio/investment-transaction-form.tsx
src/components/portfolio/manual-quote-form.tsx
src/components/portfolio/position-card.tsx
src/components/portfolio/positions-table.tsx
src/components/portfolio/allocation-chart.tsx
src/components/portfolio/quote-status.tsx
```

Client forms submit typed values to server actions. Provider keys and raw
provider responses never enter component props.

### Navigation

Refactor navigation metadata to distinguish desktop and mobile placement.

Desktop:

```text
Home
Accounts
Transactions
Portfolio
Categories
Analytics
```

Mobile:

```text
Home
Accounts
Transactions
Portfolio
More
```

`/more` links to Categories, Analytics, and import/export entry points.

## 9. Backup contract

Introduce backup schema version `2`.

Export these additional datasets:

```text
settings
investmentAccounts
assets
investmentTransactions
manualQuotes
manualExchangeRates
```

Cached Twelve Data quotes and daily snapshots are reproducible and may be
excluded.

Import order:

1. Parse and validate the entire file.
2. Validate version compatibility.
3. Start one Prisma transaction.
4. Clear child tables before parent tables.
5. Restore settings and categories.
6. Restore standard and investment-cash bank accounts.
7. Restore investment accounts and relations.
8. Restore assets.
9. Restore existing cash transactions.
10. Restore investment transactions.
11. Restore manual quotes and FX.
12. Replay portfolio and cash invariants.
13. Commit.

The current importer deletes records before all semantic validation is known.
Version 2 import must perform preflight validation before any delete operation.

## 10. Security and privacy

- No API key in `NEXT_PUBLIC_*`.
- No provider call from a client component.
- Refresh cron requires a bearer secret.
- Server errors shown to the user omit provider response bodies that may contain
  request details.
- Notes are treated as untrusted text and rendered without HTML.
- Numeric and string limits are enforced by Zod.
- Archived accounts remain read-only.

The current app has no authentication. Portfolio functionality therefore must
not be exposed to the public internet until an application-level access control
decision is made.

## 11. Performance budgets

Initial personal-use targets:

- `/portfolio` renders with at most a constant number of database round trips
  plus batched relation queries; avoid one query per position.
- Current-value calculation handles 500 investment transactions and 100 open
  positions in under 200 ms on the application host, excluding network calls.
- Cached portfolio page rendering performs no provider network request.
- Quote refresh batches requests and reports partial failures.
- Activity defaults to 50 rows with pagination.

## 12. Implementation map

Expected additions:

```text
prisma/schema.prisma
src/actions/portfolio.ts
src/actions/market-data.ts
src/app/(dashboard)/portfolio/page.tsx
src/app/(dashboard)/portfolio/accounts/[accountId]/page.tsx
src/app/(dashboard)/more/page.tsx
src/app/api/cron/portfolio-quotes/route.ts
src/components/portfolio/*
src/lib/market-data/*
src/lib/portfolio/calculations.ts
src/lib/portfolio/dtos.ts
src/lib/portfolio/validation.ts
```

Expected updates:

```text
.env.example
README.md
prisma/seed.ts
src/actions/accounts.ts
src/actions/transactions.ts
src/app/(dashboard)/page.tsx
src/components/forms/transaction-form.tsx
src/components/layout/mobile-nav.tsx
src/components/layout/nav-items.ts
src/components/layout/sidebar.tsx
src/lib/backup.ts
package.json
```

## 13. Migration and rollout

The database change is additive:

1. Widen `BankAccount.balance` to `Decimal(24,8)`.
2. Add `BankAccount.kind` with a `STANDARD` default.
3. Add settings and portfolio tables.
4. Upsert the singleton settings row.
5. Keep all current accounts and transactions unchanged.
6. Generate Prisma Client.
7. Run invariant checks before enabling Portfolio navigation.

The repository currently documents `prisma db push` for local schema sync. Use
that workflow in development. Before production deployment, take a backup and
apply the repository's production schema process; do not reset or recreate the
database.

Feature activation can be controlled with:

```text
PORTFOLIO_ENABLED=true
```

The dashboard layout reads this server-side and passes the enabled state to
client navigation components; the flag is not treated as an authorization
boundary.

During rollout:

- Schema and calculations may ship while navigation is disabled.
- Manual portfolio tracking ships before automatic quote refresh.
- Net worth integration ships only after FX completeness behavior is verified.

## 14. Architecture decisions deferred

- Authentication and per-user data ownership.
- Historical price provider and retention.
- Corporate actions and stock splits.
- Multiple cash currencies inside one investment account.
- FIFO or specific-lot cost basis.
- Broker/exchange import contracts.
- Scheduled-job hosting mechanism.
- Whether provider-derived search metadata is retained indefinitely.
