# Investment Portfolio Documentation

Status: implementation in progress

Last reviewed: 2026-07-29

Target application: Spending Tracker

This documentation defines the first implementation of stock, ETF, and
cryptocurrency portfolio tracking. It is written for the current single-user
Next.js and Prisma application.

Sprint 1 now provides the currency foundation and Sprint 2 provides manual
investment accounts, assets, opening positions, prices, and portfolio pages.
See the implementation status in the [sprint plan](./sprint-plan.md) for
completed validation and remaining browser acceptance.

## Documents

- [Product specification](./product-spec.md): product outcomes, scope, user
  stories, requirements, and acceptance criteria.
- [Technical specification](./technical-spec.md): domain model, calculations,
  market-data integration, server contracts, routes, and migration strategy.
- [Sprint plan](./sprint-plan.md): dependency-ordered implementation plan,
  organized as functional vertical slices.
- [Test plan](./test-plan.md): calculation fixtures, integration scenarios,
  user-interface checks, and release gates.

## Locked decisions

These decisions apply to the MVP unless a later architecture decision record
explicitly changes them:

1. Investment holdings are a separate ledger. A stock or cryptocurrency is not
   a `BankAccount`.
2. Investment purchases are asset transfers, not expenses. Sales and
   withdrawals are not income.
3. The application has one reporting currency, initially `PYG`.
4. Cost basis uses weighted average for the MVP.
5. Fractional shares and crypto quantities use high-precision decimals.
6. Portfolio positions are derived from immutable investment transactions.
   There is no independently editable `Holding` record.
7. Market data is accessed through a provider interface and cached in
   PostgreSQL. Provider credentials never reach the browser.
8. Twelve Data is the first quote provider, with manual assets, prices, and FX
   rates as a supported fallback.
9. Existing brokerage synchronization, tax-lot reporting, options, staking,
   and real-time streaming are outside the MVP.

## MVP completion statement

The MVP is complete when a user can:

1. Select a reporting currency.
2. Create a brokerage, exchange, or wallet account.
3. Add a stock, ETF, or cryptocurrency.
4. Enter an existing position or record buys, sells, dividends, and fees.
5. See quantity, average cost, current value, allocation, and realized and
   unrealized results.
6. Refresh cached prices without exposing an API key.
7. Include investment value in net worth without changing income or expense
   analytics.
8. Export and restore all portfolio data.
