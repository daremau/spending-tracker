export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CircleAlert } from "lucide-react";
import { getPortfolioOverview } from "@/actions/portfolio";
import { AllocationChart } from "@/components/charts/allocation-chart";
import { AssetSearch } from "@/components/portfolio/asset-search";
import { InvestmentAccountForm } from "@/components/portfolio/investment-account-form";
import { ManualAssetForm } from "@/components/portfolio/manual-asset-form";
import { OpeningPositionForm } from "@/components/portfolio/opening-position-form";
import { PortfolioAccountFilter } from "@/components/portfolio/portfolio-account-filter";
import { PositionCard } from "@/components/portfolio/position-card";
import { RefreshMarketDataButton } from "@/components/portfolio/refresh-market-data-button";
import { SignedAmount } from "@/components/portfolio/signed-amount";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildPortfolioAllocation } from "@/lib/portfolio/allocation";
import { formatPortfolioCurrency } from "@/lib/portfolio/format";

export default async function PortfolioPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string }>;
}) {
  if (process.env.PORTFOLIO_ENABLED !== "true") notFound();

  const [overview, params] = await Promise.all([
    getPortfolioOverview(),
    searchParams,
  ]);
  const activeAccounts = overview.accounts.filter(
    (account) => !account.archivedAt
  );
  const accountOptions = activeAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    cashCurrency: account.cashCurrency,
  }));

  const selectedAccountId = activeAccounts.some(
    (account) => account.id === params.accountId
  )
    ? params.accountId
    : undefined;
  const visibleAccounts = selectedAccountId
    ? activeAccounts.filter((account) => account.id === selectedAccountId)
    : activeAccounts;

  const positions = visibleAccounts.flatMap((account) => account.positions);
  const closedPositions = visibleAccounts.flatMap(
    (account) => account.closedPositions
  );

  // The overview ships allocations for the whole portfolio; a single-account
  // view has to reallocate so its shares still add up to 100%.
  const allocation = selectedAccountId
    ? buildPortfolioAllocation(
        visibleAccounts.flatMap((account) =>
          account.positions.map((position) => ({
            accountId: position.accountId,
            accountName: account.name,
            asset: position.asset,
            marketValueReporting: position.marketValueReporting,
          }))
        )
      )
    : {
        positionAllocation: overview.positionAllocation,
        assetTypeAllocation: overview.assetTypeAllocation,
      };

  const currency = overview.reportingCurrency;
  const format = (value: string | null) =>
    formatPortfolioCurrency(value, currency);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Stocks, ETFs, and cryptocurrency positions in {currency}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {positions.length > 0 && <RefreshMarketDataButton />}
          <AssetSearch />
          <ManualAssetForm />
          <InvestmentAccountForm />
          {activeAccounts.length > 0 && overview.assets.length > 0 && (
            <OpeningPositionForm
              accounts={accountOptions}
              assets={overview.assets}
            />
          )}
        </div>
      </div>

      {!overview.complete &&
        (overview.missingRates.length > 0 ||
          overview.missingQuotes.length > 0) && (
          <Alert>
            <CircleAlert />
            <AlertTitle>Portfolio total is incomplete</AlertTitle>
            <AlertDescription>
              {overview.missingQuotes.length > 0 &&
                `Missing prices: ${overview.missingQuotes.join(", ")}. `}
              {overview.missingRates.length > 0 &&
                `Missing rates: ${overview.missingRates.join(", ")}. `}
              Native-currency values stay available on each position below.
            </AlertDescription>
          </Alert>
        )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Investment value</p>
            <p className="mt-1 text-xl font-semibold">
              {format(overview.totalValueReporting)}
            </p>
            <p className="text-xs text-muted-foreground">Holdings plus cash</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Holdings</p>
            <p className="mt-1 text-xl font-semibold">
              {format(overview.holdingsValueReporting)}
            </p>
            <p className="text-xs text-muted-foreground">
              Cost {format(overview.costBasisReporting)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Investment cash</p>
            <p className="mt-1 text-xl font-semibold">
              {format(overview.cashValueReporting)}
            </p>
            <p className="text-xs text-muted-foreground">
              Fees {format(overview.feesReporting)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Unrealized</p>
            <p className="mt-1 text-xl font-semibold">
              <SignedAmount
                value={overview.unrealizedGainReporting}
                currency={currency}
              />
            </p>
            <p className="text-xs text-muted-foreground">
              Realized {format(overview.realizedGainReporting)} · Dividends{" "}
              {format(overview.dividendsReporting)}
            </p>
          </CardContent>
        </Card>
      </div>

      {activeAccounts.length > 1 && (
        <div className="flex flex-wrap items-center gap-3">
          <PortfolioAccountFilter accounts={accountOptions} />
          {selectedAccountId && (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/portfolio">Clear filter</Link>
            </Button>
          )}
        </div>
      )}

      {positions.length > 0 && (
        <div className="grid gap-3 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Allocation by position</CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart
                slices={allocation.positionAllocation.slices}
                currency={currency}
              />
              {allocation.positionAllocation.excludedSymbols.length > 0 && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                  Not charted, missing a price or rate:{" "}
                  {allocation.positionAllocation.excludedSymbols.join(", ")}.
                </p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Allocation by asset type
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AllocationChart
                slices={allocation.assetTypeAllocation.slices}
                currency={currency}
              />
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investment accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {activeAccounts.length === 0 ? (
            <div className="py-8 text-center">
              <BriefcaseBusiness className="mx-auto h-10 w-10 text-muted-foreground" />
              <h2 className="mt-3 font-medium">No investment accounts yet</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a brokerage, exchange, or wallet to start tracking.
              </p>
              <div className="mt-4">
                <InvestmentAccountForm />
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {activeAccounts.map((account) => (
                <Link
                  key={account.id}
                  href={`/portfolio/accounts/${account.id}`}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{account.name}</p>
                      <Badge variant="outline">{account.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {account.positionCount} open position
                      {account.positionCount === 1 ? "" : "s"} ·{" "}
                      {account.cashCurrency}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-right">
                    <span className="font-medium">
                      {formatPortfolioCurrency(
                        account.totalValueNative,
                        account.cashCurrency
                      )}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Open positions</h2>
        {positions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              {selectedAccountId
                ? "This account has no open positions."
                : overview.assets.length === 0
                  ? "Add an asset, then record your first opening position."
                  : activeAccounts.length === 0
                    ? "Create an investment account before adding a position."
                    : "Record an opening position to establish quantity and cost."}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {positions.map((position) => (
              <PositionCard
                key={`${position.accountId}-${position.asset.id}`}
                position={position}
              />
            ))}
          </div>
        )}
      </section>

      {closedPositions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Closed positions</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {closedPositions.map((closed) => (
                <div
                  key={`${closed.accountId}-${closed.asset.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{closed.asset.symbol}</p>
                      <Badge variant="secondary">{closed.asset.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {closed.accountName} · closed{" "}
                      {new Intl.DateTimeFormat("es-PY", {
                        dateStyle: "medium",
                      }).format(new Date(closed.lastActivityDate))}
                    </p>
                  </div>
                  <div className="text-right text-sm">
                    <p className="text-xs text-muted-foreground">Realized</p>
                    <SignedAmount
                      value={closed.realizedGainNative}
                      currency={closed.asset.quoteCurrency}
                      className="font-medium"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>
      )}

      {overview.accounts.some((account) => account.archivedAt) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Archived accounts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.accounts
              .filter((account) => account.archivedAt)
              .map((account) => (
                <Button
                  key={account.id}
                  variant="link"
                  className="h-auto p-0"
                  asChild
                >
                  <Link href={`/portfolio/accounts/${account.id}`}>
                    {account.name}
                  </Link>
                </Button>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
