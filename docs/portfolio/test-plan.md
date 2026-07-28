# Test Plan: Investment Portfolio

Status: proposed  
Last reviewed: 2026-07-28  
Related: [technical specification](./technical-spec.md) and
[sprint plan](./sprint-plan.md)

## 1. Test strategy

The highest-risk behavior is financial state, not rendering. Testing is ordered
accordingly:

1. Pure decimal calculations.
2. Database transaction and rollback behavior.
3. Market-provider normalization and failure handling.
4. Server-action validation.
5. Responsive user journeys.
6. Backup and restore.
7. Existing-feature regression.

Provider contract tests use sanitized fixtures. Unit and integration test suites
must not depend on a live quote provider.

## 2. Tooling

Add Vitest for unit and service tests.

Recommended scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Production gates:

```bash
rtk npm run lint
rtk npx tsc --noEmit
rtk npm test
rtk npm run build
```

Live-provider smoke tests are explicit and opt-in. They are not part of the
default test command.

## 3. Unit-test fixtures

Calculations use decimal strings as fixture input and compare exact decimal
strings before UI conversion.

### CALC-001: Opening position

Input:

```text
OPENING_POSITION
quantity = 0.123456789012 BTC
unit price = 60,000.12345678 USD
fees = 0
FX USD -> PYG = 7,500
```

Expected:

- Quantity retains 12 fractional digits.
- Cash effect is zero.
- Native cost equals quantity multiplied by unit price.
- Reporting cost equals native cost multiplied by 7,500.
- No realized gain.

### CALC-002: Weighted-average buys

Input:

```text
BUY 10 @ USD 100, fee USD 5
BUY 5 @ USD 120, fee USD 0
```

Expected:

```text
quantity = 15
remaining native cost = 1,605
average native cost = 107
cash effect = -1,605
```

### CALC-003: Partial sell

Starting state from CALC-002:

```text
SELL 6 @ USD 130, fee USD 2
```

Expected:

```text
gross proceeds = 780
net proceeds = 778
allocated cost = 642
realized gain = 136
remaining quantity = 9
remaining cost = 963
average cost = 107
cumulative cash effect =
  -1,605 + 778 = -827
```

### CALC-004: Full sell

Sell all remaining quantity.

Expected:

- Quantity is exact zero.
- Remaining native and reporting costs are exact zero.
- Position is closed.
- No fractional residue appears.

### CALC-005: Oversell

Attempt to sell more than the available quantity.

Expected:

- Domain error includes available quantity.
- No partial state is returned as valid.
- Database service writes nothing.

### CALC-006: Backdated invalidation

Ledger:

```text
2026-01-01 BUY 10
2026-02-01 SELL 8
```

Proposed insertion:

```text
2026-01-15 SELL 5
```

Expected:

- Complete replay becomes negative on 2026-02-01.
- Proposed insertion is rejected.

### CALC-007: Dividend and fee

Input:

```text
DIVIDEND USD 20, fee USD 1
FEE USD 3
```

Expected:

```text
cash effect = +16
dividend net value = 19
account fee = 3
quantity and cost basis unchanged
```

### CALC-008: Reporting-currency realized result

Input:

```text
BUY 1 @ USD 100, FX 7,000
SELL 1 @ USD 100, FX 7,500
```

Expected:

- Native realized result is zero.
- Reporting purchase cost is PYG 700,000.
- Reporting proceeds are PYG 750,000.
- Reporting realized result is PYG 50,000.

### CALC-009: Current value and currency movement

Input:

```text
remaining quantity = 2
remaining reporting cost = PYG 1,400,000
current quote = USD 110
current FX = 7,500
```

Expected:

```text
market value = USD 220
market value reporting = PYG 1,650,000
unrealized result reporting = PYG 250,000
```

### CALC-010: Missing current quote

Expected:

- Quantity and cost remain available.
- Market value and unrealized result are incomplete.
- Missing asset is returned in structured metadata.
- No zero price is assumed.

### CALC-011: Missing FX

Expected:

- Native market value remains available.
- Reporting value is incomplete.
- Missing pair is returned.
- No rate `1` is assumed across different currencies.

### CALC-012: Net-worth conservation

Starting:

```text
standard bank cash = USD 2,000
investment cash = USD 0
holdings = USD 0
```

Actions:

```text
fund investment cash USD 1,000
buy 5 @ USD 200, no fee
current quote USD 200
```

Expected after funding:

```text
standard cash = 1,000
investment cash = 1,000
holdings = 0
net worth = 2,000
```

Expected after buy:

```text
standard cash = 1,000
investment cash = 0
holdings = 1,000
net worth = 2,000
```

## 4. Database integration tests

Use an isolated PostgreSQL database. Each test controls its own records and
cleans only those records.

### DB-001: Investment account atomic create

- Force linked investment-account creation to fail.
- Confirm no orphan `INVESTMENT_CASH` bank account remains.

### DB-002: Balance precision migration

- Start with representative PYG and USD balances in the original scale.
- Apply the schema precision change.
- Confirm values are numerically unchanged.
- Confirm an eight-decimal investment-cash effect round-trips exactly.

### DB-003: Buy atomicity

- Create cash and an asset.
- Force investment-transaction insert or cash update failure.
- Confirm both cash and activity remain unchanged.

### DB-004: Sell atomicity

- Force a failure after validation.
- Confirm quantity replay and cash remain at their original values.

### DB-005: Idempotent create

- Submit the same `clientRequestId` twice.
- Confirm one transaction and one cash effect.

### DB-006: Concurrent submission

- Submit two buys that individually fit cash but collectively exceed it.
- Confirm database locking/transaction behavior permits at most the valid
  combined amount and never produces unintended negative cash.

Implementation note: if normal Prisma isolation is insufficient, use a
serializable transaction or conditional balance update.

### DB-007: Historical edit

- Edit an earlier buy after a later sell.
- Confirm full replay validation.
- Confirm rejected edit causes no cash delta.

### DB-008: Investment-cash deletion protection

- Call ordinary account deletion on linked cash.
- Confirm a domain error and intact relations.

### DB-009: Funding transfer

- Transfer between a standard and investment-cash account.
- Confirm two balance changes and one transfer record.
- Confirm analytics exclude it.

### DB-010: Archive behavior

- Archive an account.
- Confirm reads still return its history.
- Confirm new activity is rejected.

## 5. Provider contract tests

Provider tests mock network responses at the adapter boundary.

### MD-001: Stock normalization

- Normalize provider symbol, name, exchange, currency, and timestamp.

### MD-002: ETF classification

- Preserve ETF type instead of treating every exchange-listed asset as stock.

### MD-003: Crypto pair identity

- Preserve base/quote pair and provider symbol.

### MD-004: Batch partial success

- Response contains valid AAPL, missing asset, and invalid negative price.
- Persist AAPL only.
- Return failures for the other two.

### MD-005: Quota response

- Normalize `429` to a quota error.
- Retain cached values.
- Do not retry automatically in a loop.

### MD-006: Timeout and server error

- Abort at configured timeout.
- Permit at most the specified transient retry.
- Retain cached values.

### MD-007: Manual quote precedence

- Store manual and provider quotes.
- Effective selection chooses active manual value.
- Provider refresh changes only provider row.

### MD-008: Freshness

- Evaluate stock/ETF, crypto, FX, manual, fallback, and unavailable states at
  threshold boundaries.

### MD-009: Secret handling

- Client bundle and serialized props contain no API key.
- Sanitized error messages contain no request credential.

### MD-010: Cron authorization

- Missing bearer secret: `401`.
- Wrong bearer secret: `401`.
- Correct bearer secret: refresh summary.

## 6. Server-action validation

Test:

- Missing account, asset, date, or transaction type.
- Invalid enum.
- Empty or overlong name and notes.
- Zero or negative quantity, price, fee, cash amount, or FX.
- More than supported fractional precision.
- Asset and account currency mismatch under MVP rules.
- Activity on an archived account.
- Missing effective FX.
- Repeated idempotency key with conflicting input.
- Unknown record update/delete.
- Ordinary deletion of investment cash.

Errors must be actionable and must not expose stack traces or provider payloads.

## 7. User-interface acceptance

### UI-001: First-use flow

At 375 CSS pixels:

1. Open `/portfolio`.
2. Create a brokerage.
3. Create a manual ETF.
4. Add an opening position.
5. Add manual quote.
6. Observe quantity, cost, market value, and quote label.

Expected:

- No horizontal page scroll.
- Form errors remain next to relevant fields.
- Success closes or resets the form once.

### UI-002: Ongoing trade flow

1. Fund investment account.
2. Record a buy.
3. Record a partial sale.
4. Record dividend and fee.
5. Edit the buy.
6. Attempt an invalid delete.

Expected:

- Summary and activity update after each accepted action.
- Invalid delete explains the later dependency.
- No full-page stale state remains after revalidation.

### UI-003: Provider failure

1. Start with cached quote.
2. Simulate quota or timeout.
3. Press refresh.

Expected:

- Cached price remains visible.
- Error is non-destructive and identifies incomplete refresh.
- Timestamp still describes the cached quote.

### UI-004: Missing FX

Expected:

- Native values are visible.
- Aggregate identifies the missing pair.
- User can navigate to manual FX entry.

### UI-005: Navigation

- Desktop sidebar contains all destinations.
- Mobile bottom navigation contains exactly five.
- Portfolio stays active on account detail.
- Categories and Analytics are reachable from More.

### UI-006: Accessibility

- Every input has an accessible name.
- Dialog focus enters, remains trapped, and returns to trigger.
- All actions are keyboard operable.
- Gain/loss meaning is not conveyed only by red/green.
- Error and refresh status changes are announced appropriately.

## 8. Backup and restore tests

### BK-001: Version 2 round trip

Seed:

- Two standard bank accounts.
- One brokerage and one wallet.
- Stock, ETF, and crypto assets.
- Opening, buy, sell, dividend, and fee records.
- Manual quote and manual FX.

Export, restore into an empty isolated database, and compare:

- Record identities or stable mapped identities.
- Cash balances.
- Position quantities and cost.
- Realized and unrealized values.
- Settings and manual values.

### BK-002: High precision

- Export and import a 12-decimal crypto quantity.
- Compare exact stored decimal value.

### BK-003: Broken reference

- Import a transaction whose asset is missing.
- Confirm preflight rejection.
- Confirm current database remains unchanged.

### BK-004: Invalid ledger

- Import an oversold position history.
- Confirm preflight rejection and no deletion.

### BK-005: Legacy backup

- Import a supported version 1 bank/category/transaction backup.
- Confirm those records restore and portfolio remains empty.

### BK-006: Secret exclusion

- Search CSV and Excel content for configured provider key and refresh secret.
- Confirm neither is present.

## 9. Regression tests

Existing application behavior to verify:

- Create, rename, and delete a standard bank account.
- Create income and expense.
- Create a standard bank transfer.
- Create, edit, and delete an expense with IVA digital.
- Category analytics exclude transfers and investments.
- Account filter behavior remains correct.
- CSV and Excel version 1 behavior remains supported as specified.
- PWA navigation reaches existing routes.

Investment work must not alter the meaning of the current three transaction
types.

## 10. Performance checks

Fixture:

- 10 investment accounts.
- 100 assets.
- 500 investment transactions.
- 100 open positions.
- Cached quotes and FX for all required values.

Measure:

- Pure replay under 200 ms on the application host.
- Portfolio page uses batched database access.
- No provider request during normal cached render.
- Activity query returns at most 50 rows initially.
- Quote refresh batches rather than invoking one browser request per asset.

These are development budgets, not public SLA commitments.

## 11. Controlled live smoke test

Run only when a valid API key and network access are intentionally available.

Use a small known set:

```text
AAPL
SPY
BTC/USD
USD/PYG, if supported by the configured provider
```

Procedure:

1. Confirm `.env` is ignored by Git.
2. Search each asset.
3. Refresh each quote once.
4. Inspect source currency and timestamp.
5. Confirm provider rows exist.
6. Disable network or use an invalid endpoint.
7. Confirm cached/manual behavior.

Do not claim PYG support from provider documentation alone. Record observed
support or use a manual rate fallback.

## 12. Release checklist

- [ ] Product acceptance requirements implemented or explicitly deferred.
- [ ] Unit calculation fixtures pass.
- [ ] Database rollback and idempotency tests pass.
- [ ] Provider contract tests pass without network.
- [ ] Controlled live smoke test completed when configured.
- [ ] Mobile and desktop acceptance completed.
- [ ] Backup version 2 round trip passes.
- [ ] Existing transaction and IVA workflows pass.
- [ ] Lint passes.
- [ ] Type check passes.
- [ ] Production build passes.
- [ ] Provider keys absent from Git diff and browser assets.
- [ ] Database backup completed before production schema update.
- [ ] Feature flag and rollback procedure documented.
- [ ] Provider terms and plan limits rechecked before deployment.
