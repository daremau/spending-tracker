# Sprint Plan: Investment Portfolio

Status: implementation in progress

Last reviewed: 2026-07-29

Related: [product specification](./product-spec.md) and
[technical specification](./technical-spec.md)

## 1. Planning assumptions

- Six dependency-ordered functional sprints.
- Each sprint is a functional vertical slice with a user-visible outcome.
- Existing behavior remains releasable at the end of every sprint.
- Portfolio navigation stays feature-flagged until the sprint acceptance checks
  pass.
- Story identifiers map to the functional requirement identifiers in the
  product specification.
- Scope, not correctness, is reduced when a sprint is constrained.

### Implementation status

As of 2026-07-29, Sprint 1 through Sprint 4 code is complete.

Sprint 1:

- `AppSettings`, directional manual `ExchangeRate` records, and
  `Decimal(24,8)` bank balances are implemented.
- Currency settings and manual-rate management are available from the
  application header.
- The dashboard aggregate is currency-aware and becomes explicitly incomplete
  when a required rate is missing.
- Exact-decimal conversion and validation fixtures pass.
- The full migration chain, default `PYG` settings seed, and balance precision
  were verified against a disposable PostgreSQL database.

Sprint 2:

- Investment accounts atomically create one linked `INVESTMENT_CASH` account;
  ordinary account and spending forms only expose `STANDARD` accounts.
- The manual asset catalog supports normalized stocks, ETFs, and crypto pairs.
- Opening positions support 12-decimal quantities, historical reporting FX,
  idempotent creation, edit, delete, and complete ledger replay.
- Active manual quotes override transaction-price fallbacks without being
  overwritten by future provider rows.
- Feature-flagged portfolio overview, account detail, mobile navigation, empty
  states, and archive behavior are implemented.
- The migration chain and the brokerage/BTC/manual-quote fixture passed against
  a disposable PostgreSQL database. Both portfolio routes returned `200` with
  the fixture, and a Portfolio-enabled production build passed.

Sprint 3:

- Funding and withdrawal flows reuse one idempotent bank `TRANSFER`, update
  both balances atomically, appear in portfolio activity, and remain excluded
  from income and expense analytics.
- Buys, sells, dividends, and account- or asset-level fees validate currency,
  replay the complete affected ledger, and apply their linked-cash effect in
  the same serializable transaction.
- Historical edits and deletes apply only the exact cash delta; oversells,
  insufficient cash, and invalid later ledgers roll back without balance drift.
- Account detail shows merged funding and investment activity plus realized
  result, net dividends, and recorded fees.
- The clean migration chain now includes a safe bridge for pre-existing IVA
  Digital schema drift and portfolio-transfer idempotency.
- The fixed USD 2,000 database fixture produced USD 1,183 cash, 9 units at
  USD 107 average cost, and USD 136 realized gain before edit/delete checks.
  A concurrent-buy fixture allowed exactly one valid debit, and the
  Portfolio-enabled production build passed.

Sprint 4:

- Twelve Data is isolated behind a server-only provider interface with strict
  stock, ETF, crypto, quote, and directional-FX normalization.
- Asset search is debounced and provider selections are revalidated on the
  server before creating or reusing an asset; manual entry remains available.
- Manual quote and FX rows take precedence, fresh cached provider rows are
  skipped, and only stale linked open positions and required currencies are
  refreshed in bounded batches.
- Quote cards and currency settings distinguish manual, fresh, stale,
  transaction fallback, and unavailable values without describing stale data
  as live.
- `POST /api/cron/portfolio-quotes` uses the same refresh service as the manual
  action and requires a timing-safe bearer-secret check.
- Fifty provider/configuration/freshness/cron and existing domain tests pass. A
  disposable PostgreSQL fixture verified cache writes, manual precedence,
  transaction fallback, and cache preservation after quota failure.
- One read-only Twelve Data demo request validated AAPL search and quote
  normalization. A production build with fake server secrets passed, and those
  markers were absent from `.next/static`.

Before enabling the feature in production, complete the interactive 320, 375,
430, and 1024 CSS-pixel browser checks for Sprints 1 through 4. Automated Chrome
inspection was not available in the implementation environment.

## 2. Dependency map

```text
Sprint 1: reporting currency and FX correctness
  |
  v
Sprint 2: accounts, assets, and manual opening positions
  |
  v
Sprint 3: buys, sells, dividends, fees, and funding
  |
  v
Sprint 4: provider quotes, FX refresh, and cache resilience
  |
  v
Sprint 5: allocation, performance, navigation, and net worth
  |
  v
Sprint 6: backup, restore, hardening, and release
```

Automated calculation tests begin in Sprint 1 and grow with every slice.

## 3. Cross-sprint definition of done

Every completed story has:

- Server-side validation.
- Relevant empty, loading, error, and stale states.
- Automated tests for domain invariants.
- Mobile behavior checked at 320, 375, and 430 CSS pixels.
- Desktop behavior checked at 1024 CSS pixels or wider.
- No new lint, type-check, test, or build failures.
- No provider secret or raw credential in browser output.
- Updated specification when implementation changes a contract.

The sprint evidence command set is:

```bash
rtk npm run lint
rtk npx tsc --noEmit
rtk npm test
rtk npm run build
```

Database-affecting acceptance uses a disposable development database or a
verified backup. No sprint check resets a database containing user data.

---

## Sprint 1: Reporting currency and trustworthy totals

### Goal

Establish the currency foundation required by bank and investment net-worth
calculations.

### User-visible outcome

The dashboard no longer adds USD, PYG, or other account balances as if they were
the same currency. It either presents a correct converted total or identifies
the missing exchange rate.

### Scope

- FR-001 Reporting currency.
- Manual FX rate management.
- Currency-aware bank total.
- Safe bank-balance precision widening.
- Decimal calculation test harness.

### Stories

#### S1-01: Configure reporting currency

As a user, I can choose the currency used for aggregate totals.

Build:

- Add singleton `AppSettings`.
- Seed or upsert default `PYG`.
- Add a small settings form under `/more` or the existing import/export entry.
- Validate ISO-style three-letter currency codes.

Acceptance:

- A clean database receives `PYG`.
- A changed reporting currency persists after restart.
- Changing the setting revalidates dashboard and analytics pages.

#### S1-02: Store manual exchange rates

As a user, I can enter a required exchange rate when no provider value exists.

Build:

- Add `ExchangeRate` and source enum.
- Add create/update/deactivate server actions.
- Add explicit directional labels such as `1 USD = n PYG`.
- Implement same-currency rate `1` in the calculation service.

Acceptance:

- A positive rate is accepted.
- Zero, negative, malformed, and same-pair manual rates are rejected.
- The inverse direction is never mistaken for the entered direction.

#### S1-03: Correct existing dashboard totals

As a user, I do not see a false total when accounts use multiple currencies.

Build:

- Introduce currency conversion helpers.
- Replace the raw `reduce` in the dashboard.
- Show native account values as today.
- Show missing-rate warnings and an incomplete-total state.

Acceptance:

- `PYG 1,000,000 + USD 100` with `USD -> PYG = 7,500` produces
  `PYG 1,750,000`.
- Without the USD rate, the page identifies `USD -> PYG` as missing.
- It never displays `PYG 1,000,100`.

#### S1-04: Widen stored bank-balance precision

Build:

- Change `BankAccount.balance` from `Decimal(12,2)` to `Decimal(24,8)`.
- Keep existing bank forms limited to their current currency precision.
- Verify current balances retain their exact numeric value after schema sync.
- Keep investment quantity and price parsing separate from the existing
  two-decimal amount parser.

Acceptance:

- Existing PYG and USD balances are unchanged after the schema update.
- A linked investment-cash balance can retain an eight-decimal cash effect.
- Existing account and cash transaction forms behave as before.

#### S1-05: Add domain test tooling

Build:

- Add Vitest as a development dependency.
- Add `test` and `test:watch` scripts.
- Add unit tests for conversion, missing rates, decimal precision, and
  aggregate completeness.

### Expected files

```text
prisma/schema.prisma
prisma/seed.ts
package.json
src/actions/settings.ts
src/app/(dashboard)/more/page.tsx
src/lib/money/conversion.ts
src/lib/money/conversion.test.ts
src/app/(dashboard)/page.tsx
```

### Sprint evidence

- Automated conversion fixtures pass.
- Screenshot or manual observation of a mixed PYG/USD dashboard.
- Database inspection confirms one settings row and directional FX rows.

### Exit gate

No later portfolio aggregate starts until currency conversion can represent an
incomplete result.

---

## Sprint 2: Manual portfolio and existing positions

### Goal

Allow an existing investor to create an account and see manually entered
positions without needing external market data.

### User-visible outcome

The user can create a brokerage, exchange, or wallet, add an asset, enter an
opening position, set a manual price, and see quantity, cost, and market value.

### Scope

- FR-010 Investment accounts.
- FR-020 Asset catalog, manual path only.
- FR-030 Opening positions.
- First portion of FR-060 calculations.
- Manual portion of FR-070.
- Basic `/portfolio` and account detail routes.

### Stories

#### S2-01: Create investment accounts

Build:

- Add `BankAccountKind` and `InvestmentAccount`.
- Create investment account and linked cash account atomically.
- Exclude investment cash from normal income/expense account selectors.
- Prevent ordinary account deletion from deleting investment cash.
- Add archive behavior.

Acceptance:

- Creating `My Broker / BROKERAGE / USD` creates exactly one linked
  `INVESTMENT_CASH` account.
- A failure in either create operation leaves neither record.
- The linked cash account does not appear as an expense source.

#### S2-02: Maintain a manual asset catalog

Build:

- Add `Asset` and `AssetType`.
- Add manual asset form with symbol normalization.
- Enforce asset identity constraints.
- Support stocks, ETFs, and crypto pairs.

Acceptance:

- `aapl` is stored as `AAPL`.
- The same normalized asset and market cannot be created twice.
- `BTC/USD` retains sufficient identity to avoid collision with another crypto
  quote pair.

#### S2-03: Enter opening positions

Build:

- Add `InvestmentTransaction` with idempotency key.
- Add the pure ledger replay function.
- Implement `OPENING_POSITION`.
- Store the historical FX rate used for reporting-currency cost.
- Add create, edit, and delete actions for opening positions.

Acceptance:

- An opening position changes quantity and cost but not investment cash.
- Repeated submission with one idempotency key does not duplicate the position.
- High-precision crypto quantities round-trip through database and form.

#### S2-04: Enter manual current values

Build:

- Add `MarketQuote` manual source.
- Add manual price create/update/deactivate actions.
- Choose the effective manual quote in the calculation service.
- Label the quote as manual in the interface.

Acceptance:

- A positive manual price produces current market value.
- Deactivating it falls back to the last transaction price and labels the
  fallback.
- Provider refresh code, when added, cannot overwrite this record.

#### S2-05: Show basic portfolio pages

Build:

- Add feature-flagged `/portfolio`.
- Add investment account detail.
- Add position cards/table and basic summary.
- Provide account, asset, opening-position, and manual-price forms.

Acceptance:

- Empty portfolio and empty account states have clear primary actions.
- A stock, ETF, and crypto position render correctly on mobile.
- Closed or zero positions are not yet applicable because sells are not active.

### Expected files

```text
prisma/schema.prisma
src/actions/portfolio.ts
src/app/(dashboard)/portfolio/page.tsx
src/app/(dashboard)/portfolio/accounts/[accountId]/page.tsx
src/components/portfolio/*
src/lib/portfolio/calculations.ts
src/lib/portfolio/calculations.test.ts
src/lib/portfolio/validation.ts
```

### Sprint evidence

Demonstrate:

1. One brokerage with an AAPL opening position.
2. One exchange with a fractional BTC opening position.
3. Manual quotes and converted reporting values.
4. No change to bank cash or expense analytics.

### Exit gate

The pure replay result and database result agree for all opening-position test
fixtures.

---

## Sprint 3: Investment transactions and cash integrity

### Goal

Support the complete MVP investment ledger with atomic cash effects and
weighted-average cost basis.

### User-visible outcome

The user can fund an account, buy, sell, receive dividends, and record fees.
Cash, positions, and realized results remain consistent after create, edit, and
delete operations.

### Scope

- FR-040 Investment activity.
- FR-050 Funding and withdrawals.
- Complete FR-060 weighted-average calculations.

### Stories

#### S3-01: Fund and withdraw investment cash

Build:

- Add a portfolio funding flow over the existing bank `TRANSFER`.
- Limit destinations to the selected account's linked investment cash account.
- Add withdrawal flow in the opposite direction.
- Show funding events in bank transaction history and investment activity.

Acceptance:

- Funding reduces the source bank balance and increases investment cash once.
- Withdrawal reverses the direction.
- Neither operation changes income or expense analytics.

#### S3-02: Record buys

Build:

- Validate asset/account currency compatibility for the MVP.
- Compute gross value on the server.
- Replay the proposed ledger.
- Create the transaction and decrement linked cash atomically.

Acceptance:

- Insufficient cash rejects the entire operation.
- A successful buy changes cash, quantity, and cost exactly once.
- Fees increase cost basis and reduce cash.

#### S3-03: Record sells

Build:

- Enforce quantity available as of the effective date.
- Allocate weighted-average cost.
- Increase cash by proceeds less fees.
- Calculate native and reporting-currency realized result.

Acceptance:

- Partial and full sales produce expected cost allocation.
- A full sale forces remaining quantity and cost to exact zero.
- Oversells and backdated transactions that create a later negative position
  are rejected.

#### S3-04: Record dividends and fees

Build:

- Add asset dividend and account/asset fee forms.
- Apply cash effects.
- Track dividends and fees separately from income/expense analytics.

Acceptance:

- A dividend increases investment cash and portfolio income metrics.
- A fee reduces investment cash and portfolio performance.
- Neither appears in spending category totals.

#### S3-05: Edit and delete safely

Build:

- Calculate original and proposed cash effects.
- Replay the complete proposed asset ledger.
- Apply the cash-effect difference in one transaction.
- Preserve idempotent create behavior.

Acceptance:

- Editing a buy price changes cash and cost by the exact delta.
- Deleting a historical buy is rejected if it makes a later sale invalid.
- Any thrown error leaves both cash and activity unchanged.

### Expected files

```text
src/actions/portfolio.ts
src/actions/transactions.ts
src/app/(dashboard)/transactions/*
src/components/portfolio/investment-transaction-form.tsx
src/components/portfolio/investment-activity.tsx
src/lib/portfolio/calculations.ts
src/lib/portfolio/calculations.test.ts
```

### Sprint evidence

Run one fixed ledger:

1. Fund USD 2,000.
2. Buy 10 units at USD 100 with a USD 5 fee.
3. Buy 5 units at USD 120 with no fee.
4. Sell 6 units at USD 130 with a USD 2 fee.
5. Record a USD 10 dividend.
6. Verify cash, remaining quantity, average cost, and realized result against the
   documented fixture in the test plan.

### Exit gate

Create, edit, delete, backdating, insufficient cash, and oversell tests pass
with no balance drift.

---

## Sprint 4: Automatic quotes and FX

### Goal

Add resilient server-side market data while preserving manual and cached
operation.

### User-visible outcome

The user can search supported assets and refresh quotes. If the provider is
unavailable or limited, the portfolio still shows the last valid values with a
clear status.

### Scope

- Provider-backed portion of FR-020.
- Provider-backed portion of FR-070.
- Protected refresh route and quota behavior.

### Stories

#### S4-01: Implement the provider abstraction

Build:

- Add provider types and normalized errors.
- Implement Twelve Data asset search, quotes, and FX.
- Add server-only environment validation.
- Use timeout and credential-safe logging.

Acceptance:

- Mock contract tests normalize stock, ETF, crypto, quote, and FX responses.
- Invalid and partial provider responses cannot write malformed database rows.
- No provider secret appears in client JavaScript or serialized props.

#### S4-02: Add provider-backed asset search

Build:

- Debounced client search calling a server action.
- Type and market filters.
- Explicit manual-entry fallback.
- Provider symbol saved exactly as returned.

Acceptance:

- Selecting a result creates or reuses one normalized asset.
- Empty, timeout, quota, and no-match states are distinguishable.
- Search results cannot submit arbitrary server-only fields.

#### S4-03: Refresh stale quotes and FX

Build:

- Select only open positions and needed currencies.
- Skip fresh values and active manual values.
- Batch within provider limits.
- Upsert valid results and return per-symbol outcomes.

Acceptance:

- Refreshing ten positions does not perform ten uncontrolled browser calls.
- One invalid symbol does not discard other valid quote updates.
- Last valid cached data survives total provider failure.

#### S4-04: Add protected scheduled-refresh endpoint

Build:

- Add `POST /api/cron/portfolio-quotes`.
- Verify bearer secret.
- Return a compact refresh summary.
- Document environment variables in `.env.example`.

Acceptance:

- Missing or incorrect secret returns `401`.
- Valid secret invokes the same service used by manual refresh.
- Route logs contain no credentials.

#### S4-05: Display freshness

Build:

- Add quote status component.
- Apply stock/ETF, crypto, FX, and manual thresholds.
- Show source timestamp and manual/fallback labels.

Acceptance:

- Fresh, stale, manual, fallback, and unavailable states can be reproduced with
  fixtures.
- Stale values remain visible and are never described as live.

### Expected files

```text
.env.example
src/actions/market-data.ts
src/app/api/cron/portfolio-quotes/route.ts
src/components/portfolio/asset-search.tsx
src/components/portfolio/quote-status.tsx
src/lib/market-data/*
```

### Sprint evidence

- Provider contract tests use recorded, sanitized fixtures.
- One controlled live request validates configured symbols when an API key is
  available.
- The provider remains optional: portfolio page rendering and the production
  build complete without making a market-data request.
- A disposable database fixture confirms that manual rows are never
  overwritten, stale provider cache is refreshed, and quota failures preserve
  the last valid cache.
- The manual fallback demo succeeds with network access disabled.

### Exit gate

Portfolio page rendering remains network-independent and all provider failures
degrade to cached/manual behavior.

---

## Sprint 5: Portfolio insights, net worth, and navigation

### Goal

Turn the ledger into a complete daily-use portfolio and net-worth experience.

### User-visible outcome

The user sees allocation, realized and unrealized results, quote freshness, and
a correct combined net worth from the dashboard on mobile and desktop.

### Scope

- FR-080 Portfolio overview.
- FR-090 Navigation and responsive behavior.
- Net-worth integration.
- Account and position presentation polish.

### Stories

#### S5-01: Complete portfolio overview

Build:

- Summary cards for investment value, cash, cost, and performance.
- Position allocation and asset-type allocation charts.
- Account filter.
- Open and closed position treatment.
- Missing quote/FX completeness banner.

Acceptance:

- Allocations sum to approximately 100% after display rounding.
- A missing quote or FX rate marks totals incomplete.
- Native-currency values remain available when conversion is incomplete.

#### S5-02: Integrate dashboard net worth

Build:

- Separate standard bank cash and investment value.
- Count investment cash exactly once.
- Add investment summary and Portfolio link.
- Preserve existing monthly income and expense behavior.

Acceptance:

- Net worth matches bank cash plus investment cash plus holdings.
- Funding a portfolio does not change net worth before fees or price movement.
- Buying an investment does not change net worth at equal trade and market
  price, except for fees.

#### S5-03: Refactor navigation

Build:

- Add Portfolio to desktop sidebar.
- Add mobile `More` destination.
- Move Categories and Analytics under More on mobile.
- Keep active-route behavior correct for portfolio detail routes.

Acceptance:

- Mobile bottom navigation has five items.
- Portfolio detail keeps Portfolio highlighted.
- Categories and Analytics remain reachable within two taps.

#### S5-04: Responsive and accessible presentation

Build:

- Mobile position cards or bounded table scrolling.
- Keyboard-accessible forms and dialogs.
- Visible focus, labels, input errors, and non-color-only gain/loss indicators.
- Loading and skeleton treatment where appropriate.

Acceptance:

- No horizontal page overflow at 320 CSS pixels.
- All portfolio mutations can be completed with a keyboard.
- Positive/negative results have text or sign indicators in addition to color.

### Expected files

```text
src/app/(dashboard)/page.tsx
src/app/(dashboard)/portfolio/page.tsx
src/app/(dashboard)/more/page.tsx
src/components/layout/*
src/components/portfolio/*
src/components/charts/*
```

### Sprint evidence

- Mobile and desktop screenshots for empty, complete, and incomplete portfolios.
- Fixed net-worth fixture demonstrates funding, buy, fee, and quote movement.
- Existing analytics results are unchanged for the same cash transaction data.

### Exit gate

The feature flag can be enabled for normal use when all portfolio totals are
complete or explicitly labeled incomplete.

---

## Sprint 6: Backup, restore, hardening, and release

### Goal

Make portfolio data recoverable and establish release confidence.

### User-visible outcome

The user can export and restore the complete portfolio, and the enabled feature
has documented operational behavior.

### Scope

- FR-100 Backup and restore.
- Full regression and fault testing.
- Documentation and controlled release.

### Stories

#### S6-01: Version the backup format

Build:

- Add schema version `2`.
- Export settings, investment accounts, assets, investment transactions, manual
  quotes, and manual FX.
- Add Excel worksheets and CSV sections.
- Preserve version `1` import compatibility where practical.

Acceptance:

- Export contains no provider secret.
- High-precision quantities survive the supported serialized precision.
- Manual data is included; reproducible provider cache can be omitted.

#### S6-02: Preflight and atomic restore

Build:

- Parse and validate the complete backup before deletion.
- Validate identity references and transaction invariants.
- Restore all supported records in one Prisma transaction.
- Replay positions and linked cash consistency before commit.

Acceptance:

- A malformed asset reference leaves existing data untouched.
- An oversold imported ledger leaves existing data untouched.
- A successful export/import round trip reproduces portfolio totals.

#### S6-03: Regression and failure hardening

Build:

- Execute the complete test plan.
- Test provider timeout, quota, partial response, and invalid currency.
- Test backdated edits and simultaneous repeated submission.
- Verify ordinary bank account and transaction workflows.

Acceptance:

- No drift between ledger cash effect and linked cash balance.
- No portfolio activity appears in spending analytics.
- Existing IVA digital behavior remains unchanged.

#### S6-04: Release documentation

Build:

- Update root README and `.env.example`.
- Add setup, refresh, backup, and manual fallback instructions.
- Record provider licensing caveat and review date.
- Document feature-flag enable and rollback steps.

Acceptance:

- A clean local setup can enable manual portfolio tracking without an API key.
- Adding an API key enables search and refresh.
- Disabling the feature flag hides entry points without deleting data.

### Expected files

```text
README.md
.env.example
src/lib/backup.ts
src/actions/backup.ts
src/components/import-export/*
docs/portfolio/*
```

### Sprint evidence

- Version 2 backup round trip.
- Full automated command output.
- Manual acceptance checklist signed off.
- Feature flag enabled only after database backup.

### Exit gate

The MVP completion statement in `docs/portfolio/README.md` is demonstrably true.

---

## 4. Post-MVP sprint candidates

These are deliberately not mixed into the six MVP sprints.

### Historical performance

- Daily portfolio snapshots.
- Historical asset prices.
- Net deposits separated from investment return.
- Money-weighted and time-weighted return.

### Imports and synchronization

- CSV trade import with dry-run preview.
- Broker-specific adapters.
- Duplicate detection and idempotent synchronization.
- No external writes; integrations are read-only.

### Corporate actions and tax lots

- Splits, mergers, symbol changes, and spin-offs.
- FIFO and specific-lot selection.
- Jurisdiction-specific reports only after legal/accounting requirements are
  separately specified.

### Advanced assets

- Multi-currency cash ledgers.
- Bonds, mutual funds, staking, and yield.
- Options or leveraged products only after negative quantities and liabilities
  are modeled explicitly.

## 5. Scope-cut order

If the MVP must be shortened, remove work in this order:

1. Scheduled refresh endpoint; retain manual refresh.
2. Provider-backed FX; retain manual FX.
3. Allocation charts; retain position table and totals.
4. Closed-position presentation; retain activity history.
5. Provider asset search; retain manual asset creation.

Do not cut:

- Currency completeness.
- Decimal precision.
- Atomic cash effects.
- Oversell protection.
- Manual price/FX fallback.
- Backup of user-entered portfolio data.
