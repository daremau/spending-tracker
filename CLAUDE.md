# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev:up           # One command: start Postgres (Docker) + sync schema + seed + next dev
npm run dev              # Start Next.js dev server only (assumes DB already running)
npm run build            # Production build
npm run lint             # Run ESLint

# Tests (Vitest, node environment, @ alias configured in vitest.config.ts)
npm test                 # Run once
npm run test:watch       # Watch mode
npx vitest run src/lib/portfolio/calculations.test.ts   # Single file

# Database
docker compose up db -d  # Start PostgreSQL (port 5434)
npx prisma db push       # Apply schema changes
npx prisma generate      # Regenerate Prisma client
npx prisma studio        # Open database GUI
npx prisma db seed       # Seed default categories

# Type checking
npx tsc --noEmit
```

## Architecture

### Tech Stack
- Next.js 16 with App Router (React 19)
- PostgreSQL with Prisma ORM
- shadcn/ui components (Radix + Tailwind CSS 4)
- Recharts for charts
- Zod for validation, react-hook-form for forms
- decimal.js for all money math
- exceljs for CSV/Excel backup files
- Vitest for unit tests

### Feature Flag

`PORTFOLIO_ENABLED=true` gates the entire portfolio feature: the `/portfolio`
routes (`notFound()` otherwise), the sidebar/mobile nav entries, dashboard
widgets, and `POST /api/cron/portfolio-quotes`. Turning it off only hides entry
points — no data is deleted. Restart the server after changing it.

### Key Patterns

**Server Actions**: All database mutations go through server actions in `src/actions/`. These use `"use server"` directive and handle:
- Zod validation of `FormData`
- Prisma transactions for balance consistency
- `revalidatePath()` for cache invalidation

**Transaction Balance Management**: When creating/updating/deleting transactions, account balances are updated atomically within Prisma transactions. See `applyTransactionBalance` and `revertTransactionBalance` in `src/actions/transactions.ts`.

**IVA Digital (Paraguay Digital Tax)**: Expenses can optionally include a 10% digital tax which creates a linked child transaction. Tax transactions cannot be edited/deleted directly.

**Decimal Handling**: Precision differs by column — `Transaction.amount` is
`Decimal(12,2)`, `BankAccount.balance` and prices/cash are `Decimal(24,8)`,
investment quantities are `Decimal(30,12)`, and FX rates are `Decimal(24,10)`.
Cash-ledger actions (`transactions.ts`) convert to `Number` before returning to
components. Portfolio and money code never does: `src/lib/money` and
`src/lib/portfolio` take and return **decimal strings**, computed with a
`Decimal.clone({ precision: 50, rounding: ROUND_HALF_UP })` instance. Do not
route a portfolio quantity or balance through a JS number.

**Idempotency**: `Transaction.clientRequestId` and
`InvestmentTransaction.clientRequestId` are unique. Forms generate the id
client-side; a replayed submit finds the existing row and, if every field
matches (`investmentActivityMatches`), succeeds without writing twice.

**Serializable writes**: Portfolio mutations run through
`withSerializableRetry` in `src/actions/portfolio.ts` — a serializable Prisma
transaction retried up to 3 times on `P2034`. Ledger-affecting writes replay
the asset's full ledger (`validateProposedAssetLedger` → `replayLedger`) inside
that transaction so an oversell is rejected before it commits.

**Positions are derived**: There is no editable holdings table. Quantity,
average cost, and realized/unrealized results come from replaying immutable
`InvestmentTransaction` rows in date/createdAt/id order
(`src/lib/portfolio/calculations.ts`). Cost basis is weighted average.

**Currency conversion**: One reporting currency lives in `AppSettings`.
`convertAmount`/`aggregateMoney` in `src/lib/money/conversion.ts` return either
a complete value or `{ value: null, missingRates: [...] }` — an unconvertible
amount is surfaced as an explicit gap, never silently dropped. `MANUAL` rates
and quotes always win over provider ones, so a manual override survives any
refresh.

**Market data**: Provider access sits behind the `MarketDataProvider` interface
(`src/lib/market-data/provider.ts`, Twelve Data implementation). Results are
cached in `MarketQuote`/`ExchangeRate`; a failed refresh keeps the last cached
values and labels them stale via `quoteFreshness`
(`MANUAL | FRESH | STALE | FALLBACK | UNAVAILABLE`). Provider errors become
`MarketDataError` and reach the client only through `publicMarketDataError`.
`TWELVE_DATA_API_KEY` is server-only and must never reach the browser or a
backup file.

**Backup/restore**: Schema version 2 (`src/lib/backup/`), CSV and Excel. Rows
reference each other by natural key (account name, category name+type, asset
type+symbol+market) so a restore rebuilds the graph from scratch; every number
is serialized as a string. Provider-fetched quotes and rates are deliberately
excluded — they are a refetchable cache. `restoreBackup` runs `preflightBackup`
first (identity refs, transfer targets, tax-parent links, ledger replay,
investment cash balances) and only then deletes and reinserts inside one
transaction, so a rejected import leaves existing data untouched. Version 1
files still import.

### Data Models

Cash ledger:
- **BankAccount**: balance + currency (default PYG). `kind` is `STANDARD` or `INVESTMENT_CASH` (the latter is owned by an `InvestmentAccount`)
- **Category**: INCOME or EXPENSE, has color for UI
- **Transaction**: INCOME/EXPENSE/TRANSFER. Transfers link two accounts via `accountId` and `toAccountId`
- **AppSettings**: singleton row holding reporting currency and timezone

Portfolio:
- **InvestmentAccount**: BROKERAGE/EXCHANGE/WALLET, each owning exactly one `INVESTMENT_CASH` bank account
- **Asset**: STOCK/ETF/CRYPTO, unique on `(type, symbol, market)`, optional provider symbol
- **InvestmentTransaction**: OPENING_POSITION/BUY/SELL/DIVIDEND/FEE, stores the FX rate to reporting currency at entry time
- **MarketQuote** / **ExchangeRate**: cached prices and rates, one active row per `(asset, source)` / `(pair, source)`, source `TWELVE_DATA` or `MANUAL`

### Project Layout

```
src/
├── actions/          # Server actions: accounts, transactions, categories,
│                     # portfolio, market-data, settings, backup
├── app/
│   ├── (dashboard)/  # Pages: dashboard, accounts, transactions, analytics,
│   │                 # categories, portfolio, more
│   └── api/
│       ├── backup/               # POST import (multipart CSV/Excel)
│       └── cron/portfolio-quotes/ # POST refresh, bearer PORTFOLIO_REFRESH_SECRET
├── components/
│   ├── ui/           # shadcn/ui primitives
│   ├── forms/        # Transaction and account forms
│   ├── portfolio/    # Investment accounts, activity, assets, quotes
│   ├── charts/       # Recharts components
│   ├── import-export/# Backup export/import panels
│   ├── settings/     # Currency and manual FX rate dialog
│   ├── pwa/          # Service worker registration
│   └── layout/       # Header, sidebar, mobile nav, nav-items
└── lib/
    ├── prisma.ts     # Singleton Prisma client
    ├── format.ts     # Currency/date formatting
    ├── money/        # Conversion + currency validation (decimal strings)
    ├── portfolio/    # Ledger replay, allocation, net worth, DTOs, validation
    ├── market-data/  # Provider interface, Twelve Data, config, freshness
    └── backup/       # collect → serialize / parse → preflight → restore
```

### Environment

See `.env.example`. `DATABASE_URL` is required; `PORTFOLIO_ENABLED` gates the
portfolio; `MARKET_DATA_PROVIDER`, `TWELVE_DATA_API_KEY`, and
`MARKET_DATA_TIMEOUT_MS` are optional (without a key the portfolio runs fully
on manual assets, prices, and rates); `PORTFOLIO_REFRESH_SECRET` is required
only for the cron refresh route.

### Path Alias
Use `@/*` to import from `src/*` (e.g., `@/lib/prisma`, `@/components/ui/button`).

### Further Reading
`docs/portfolio/` holds the product spec, technical spec, sprint plan, and test
plan for the portfolio feature, including its locked design decisions.
