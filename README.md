# Spending Tracker

A mobile-first web application for tracking personal finances across multiple bank accounts.

## Features

- Bank account management (add, delete accounts)
- Transaction tracking (income, expenses, transfers)
- Transaction categories with colors
- Dashboard with account summaries
- Analytics with spending charts
- Feature-flagged manual stock, ETF, and cryptocurrency portfolios

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
```

Set `PORTFOLIO_ENABLED=true` to show the manual Portfolio routes and navigation.

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
