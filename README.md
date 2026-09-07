# Spending Tracker

A mobile-first web application for tracking personal finances across multiple bank accounts.

## Features

- Bank account management (add, delete accounts)
- Transaction tracking (income, expenses, transfers)
- Transaction categories with colors
- Dashboard with account summaries
- Analytics with spending charts
- Feature-flagged stock, ETF, and cryptocurrency portfolios with funding,
  trades, dividends, fees, manual overrides, and optional cached market data
- Combined net worth across bank cash and investments
- Versioned backup and atomic restore of every user-entered record

## Feature Specifications

- [Stock, ETF, and cryptocurrency portfolio](docs/portfolio/README.md)

## Tech Stack

- **Frontend**: Next.js 16 + shadcn/ui + Tailwind CSS
- **Database**: PostgreSQL with Prisma 6 ORM
- **Charts**: Recharts
- **Containerization**: Docker + docker-compose

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm

## Quick Start

Install dependencies, then start everything with a single command:

```bash
npm install
npm run dev:up
```

`npm run dev:up` brings up the whole local stack:

1. Starts PostgreSQL in Docker and waits until it's healthy
2. Syncs the Prisma schema (`prisma db push`) and regenerates the client
3. Seeds default categories (skipped if they already exist)
4. Starts the Next.js dev server with native hot reload

Then open [http://localhost:3000](http://localhost:3000) in your browser.

> Note: The database runs on port 5434 to avoid conflicts with local PostgreSQL installations. Only Postgres runs in Docker — `next dev` runs on the host for fast hot reload.

## Manual Setup

If you prefer to run the steps individually (or the DB is already running, in which case just use `npm run dev`):

```bash
# 1. Install dependencies
npm install

# 2. Start the database (runs on port 5434)
docker compose up db -d

# 3. Apply schema + regenerate Prisma client
npx prisma db push

# 4. Seed default categories (optional)
npx prisma db seed

# 5. Start the dev server
npm run dev
```

The `.env` file should already exist with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/spending_tracker?schema=public"
PORTFOLIO_ENABLED=true

# Optional server-only automatic quotes and FX
MARKET_DATA_PROVIDER=twelve-data
TWELVE_DATA_API_KEY=
MARKET_DATA_TIMEOUT_MS=8000

# Required only for POST /api/cron/portfolio-quotes
PORTFOLIO_REFRESH_SECRET=
```

## Portfolio

### Enabling and rolling back

Set `PORTFOLIO_ENABLED=true` to show the Portfolio routes, the sidebar entry,
and the mobile `More` destination. Restart the server after changing it.

To roll back, set `PORTFOLIO_ENABLED=false` and restart. The routes return 404
and the navigation entries disappear, but **no portfolio data is deleted** —
re-enabling the flag brings everything back. Take a backup before enabling the
flag on a database that already holds data.

### Working without an API key

A clean setup needs no API key. With `TWELVE_DATA_API_KEY` empty you can still:

- create brokerage, exchange, and wallet accounts;
- add assets by hand;
- record opening positions, buys, sells, dividends, and fees;
- enter manual prices per asset and manual exchange rates per currency pair.

Manual prices and rates always take precedence over provider values, so a
manual override is never overwritten by a later refresh.

### Adding an API key

Setting `TWELVE_DATA_API_KEY` additionally enables provider asset search and
the **Refresh** button on the portfolio page. The key is read only by server
code and never reaches the browser or a backup file. A refresh updates a
PostgreSQL cache; if the provider times out or hits its quota, the last valid
cached values remain visible and are labelled stale rather than live.

Twelve Data's free tier is rate limited and its market data is licensed for
personal use. Review your plan's terms before relying on it. Last reviewed:
2026-07-30.

### Scheduled refresh

`POST /api/cron/portfolio-quotes` runs the same refresh service as the button.
Set `PORTFOLIO_REFRESH_SECRET` and call it with a bearer token:

```bash
curl -X POST https://your-host/api/cron/portfolio-quotes \
  -H "Authorization: Bearer $PORTFOLIO_REFRESH_SECRET"
```

A missing or incorrect secret returns `401`.

## Backup and restore

Export and import live behind the header's backup button, in CSV and Excel.

Exports use **schema version 2**, which covers reporting-currency settings,
bank accounts, categories, transactions (including IVA Digital parent/child
links), manual exchange rates, the asset catalog, investment accounts,
investment transactions, and manual quotes. Numbers are written as text so
8-decimal balances and 12-decimal quantities survive a spreadsheet round trip.

Provider-fetched quotes and rates are deliberately excluded: they are a
refetchable cache, and restoring them would present old prices as current. No
API key or secret is ever written to a backup.

Importing **replaces all existing data**. The file is fully validated first —
identity references, transfer destinations, tax-parent links, ledger replay for
oversells, and each investment cash balance against its own ledger. If any
check fails, the import is rejected and your existing data is left untouched.
Only a file that passes every check is restored, and the restore itself runs in
one database transaction that rolls back on any error.

Version 1 backups still import; their accounts are read as standard bank
accounts.

## Production (Docker)

The full stack (app + PgBouncer + Postgres + migrations) runs via Docker, fronted by Traefik:

```bash
# Build and run everything
docker compose up --build

# Or run in background
docker compose up -d --build
```

## Useful Commands

```bash
# Start database only
docker compose up db -d

# Stop all containers
docker compose down

# Reset database (deletes all data)
docker compose down -v
docker compose up db -d
npx prisma db push

# View database in Prisma Studio
npx prisma studio

# Type check
npx tsc --noEmit

# Build for production
npm run build
```

## Project Structure

```
spending-tracker/
├── docker-compose.yml      # Docker services
├── Dockerfile              # Production build
├── prisma/
│   └── schema.prisma       # Database models
├── src/
│   ├── app/
│   │   └── (dashboard)/    # Main app pages
│   ├── actions/            # Server actions
│   ├── components/
│   │   ├── ui/             # shadcn components
│   │   ├── forms/          # Form components
│   │   ├── charts/         # Chart components
│   │   └── layout/         # Layout components
│   └── lib/                # Utilities
└── .env                    # Environment variables
```
