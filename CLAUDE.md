# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run dev              # Start Next.js dev server on http://localhost:3000
npm run build            # Production build
npm run lint             # Run ESLint

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
- Zod for validation

### Key Patterns

**Server Actions**: All database mutations go through server actions in `src/actions/`. These use `"use server"` directive and handle:
- Form validation
- Prisma transactions for balance consistency
- `revalidatePath()` for cache invalidation

**Transaction Balance Management**: When creating/updating/deleting transactions, account balances are updated atomically within Prisma transactions. See `applyTransactionBalance` and `revertTransactionBalance` in `src/actions/transactions.ts`.

**IVA Digital (Paraguay Digital Tax)**: Expenses can optionally include a 10% digital tax which creates a linked child transaction. Tax transactions cannot be edited/deleted directly.

**Prisma Decimal Handling**: `BankAccount.balance` and `Transaction.amount` are stored as `Decimal(12,2)`. Server actions convert these to `Number` before returning to components.

### Data Models

- **BankAccount**: Holds balance, supports multiple currencies (default: PYG)
- **Category**: Typed as INCOME or EXPENSE, has color for UI
- **Transaction**: INCOME/EXPENSE/TRANSFER types. Transfers link two accounts via `accountId` and `toAccountId`

### Project Layout

```
src/
├── actions/          # Server actions (accounts, transactions, categories, excel)
├── app/(dashboard)/  # All pages use dashboard layout with mobile nav
├── components/
│   ├── ui/           # shadcn/ui primitives
│   ├── forms/        # Transaction and account forms
│   ├── charts/       # Recharts components
│   └── layout/       # Header, mobile nav
└── lib/
    ├── prisma.ts     # Singleton Prisma client
    └── excel*.ts     # Excel import/export utilities
```

### Path Alias
Use `@/*` to import from `src/*` (e.g., `@/lib/prisma`, `@/components/ui/button`).
