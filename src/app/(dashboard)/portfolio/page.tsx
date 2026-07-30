export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CircleAlert } from "lucide-react";
import { getPortfolioOverview } from "@/actions/portfolio";
import { AssetSearch } from "@/components/portfolio/asset-search";
import { InvestmentAccountForm } from "@/components/portfolio/investment-account-form";
import { ManualAssetForm } from "@/components/portfolio/manual-asset-form";
import { OpeningPositionForm } from "@/components/portfolio/opening-position-form";
import { PositionCard } from "@/components/portfolio/position-card";
import { RefreshMarketDataButton } from "@/components/portfolio/refresh-market-data-button";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function formatCurrency(value: string | null, currency: string) {
  if (value === null) return "Incomplete";
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PYG" ? 0 : 2,
  }).format(Number(value));
}

export default async function PortfolioPage() {
  if (process.env.PORTFOLIO_ENABLED !== "true") notFound();

  const overview = await getPortfolioOverview();
  const activeAccounts = overview.accounts.filter(
    (account) => !account.archivedAt
  );
  const accountOptions = activeAccounts.map((account) => ({
    id: account.id,
    name: account.name,
    type: account.type,
    cashCurrency: account.cashCurrency,
  }));
  const positions = activeAccounts.flatMap((account) => account.positions);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Manual stocks, ETFs, and cryptocurrency positions.
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
                `Missing rates: ${overview.missingRates.join(", ")}.`}
            </AlertDescription>
          </Alert>
        )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total value</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                overview.totalValueReporting,
                overview.reportingCurrency
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Holdings</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                overview.holdingsValueReporting,
                overview.reportingCurrency
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Investment cash</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                overview.cashValueReporting,
                overview.reportingCurrency
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open cost</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                overview.costBasisReporting,
                overview.reportingCurrency
              )}
            </p>
          </CardContent>
        </Card>
      </div>

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
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{account.name}</p>
                      <Badge variant="outline">{account.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {account.positionCount} open position
                      {account.positionCount === 1 ? "" : "s"} ·{" "}
                      {account.cashCurrency}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-medium">
                      {formatCurrency(
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
              {overview.assets.length === 0
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
