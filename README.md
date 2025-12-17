# Spending Tracker

A mobile-first web application for tracking personal finances across multiple bank accounts.

## Features

- Bank account management (add, delete accounts)
- Transaction tracking (income, expenses, transfers)
- Transaction categories with colors
- Dashboard with account summaries
- Analytics with spending charts

## Tech Stack

- **Frontend**: Next.js 16 + shadcn/ui + Tailwind CSS
- **Database**: PostgreSQL with Prisma ORM
- **Charts**: Recharts
- **Containerization**: Docker + docker-compose

## Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm

## Setup

### 1. Clone and install dependencies

```bash
npm install
```

### 2. Start the database

```bash
docker compose up db -d
```

> Note: The database runs on port 5434 to avoid conflicts with local PostgreSQL installations.

### 3. Set up environment variables

The `.env` file should already exist with:

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5434/spending_tracker?schema=public"
```

### 4. Run database migrations

```bash
npx prisma db push
```

### 5. Generate Prisma client

```bash
npx prisma generate
```

### 6. Seed default categories (optional)

```bash
npx prisma db seed
```

## Running the App

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production (Docker)

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
