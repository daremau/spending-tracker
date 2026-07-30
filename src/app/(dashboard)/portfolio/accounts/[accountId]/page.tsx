export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Archive } from "lucide-react";
import { getInvestmentAccountDetail } from "@/actions/portfolio";
import { InvestmentAccountActions } from "@/components/portfolio/investment-account-actions";
import { InvestmentTransactionForm } from "@/components/portfolio/investment-transaction-form";
import { OpeningPositionForm } from "@/components/portfolio/opening-position-form";
import { PortfolioTransferForm } from "@/components/portfolio/portfolio-transfer-form";
import { PositionCard } from "@/components/portfolio/position-card";
import { SignedAmount } from "@/components/portfolio/signed-amount";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPortfolioCurrency } from "@/lib/portfolio/format";

function formatCurrency(value: string | null, currency: string) {
  return formatPortfolioCurrency(value, currency, {
    maximumFractionDigits: currency === "PYG" ? 0 : 8,
  });
}

export default async function InvestmentAccountPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  if (process.env.PORTFOLIO_ENABLED !== "true") notFound();
  const { accountId } = await params;
  const detail = await getInvestmentAccountDetail(accountId);
  if (!detail) notFound();

  const archived = Boolean(detail.account.archivedAt);
  const accountOptions = [
    {
      id: detail.account.id,
      name: detail.account.name,
      type: detail.account.type,
      cashCurrency: detail.account.cashCurrency,
    },
  ];
  const timeline = [
    ...detail.activities.map((activity) => ({
      kind: "INVESTMENT" as const,
      date: activity.date,
      activity,
    })),
    ...detail.fundingActivities.map((activity) => ({
      kind: "TRANSFER" as const,
      date: activity.date,
      activity,
    })),
  ].sort(
    (left, right) =>
      new Date(right.date).getTime() - new Date(left.date).getTime()
  );

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/portfolio" aria-label="Back to portfolio">
              <ArrowLeft />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{detail.account.name}</h1>
              <Badge variant="outline">{detail.account.type}</Badge>
              {archived && (
                <Badge variant="secondary">
                  <Archive />
                  Archived
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Cash currency: {detail.account.cashCurrency}
            </p>
          </div>
        </div>
        {!archived && (
          <div className="flex flex-wrap gap-2">
            <PortfolioTransferForm
              account={accountOptions[0]}
              bankAccounts={detail.standardAccounts}
            />
            <InvestmentTransactionForm
              account={accountOptions[0]}
              assets={detail.assets}
            />
            <OpeningPositionForm
              accounts={accountOptions}
              assets={detail.assets}
              defaultAccountId={detail.account.id}
            />
            <InvestmentAccountActions
              id={detail.account.id}
              name={detail.account.name}
            />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total value</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                detail.account.totalValueNative,
                detail.account.cashCurrency
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Investment cash</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                detail.account.cashBalance,
                detail.account.cashCurrency
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Holdings</p>
            <p className="mt-1 text-xl font-semibold">
              {formatCurrency(
                detail.account.holdingsValueNative,
                detail.account.cashCurrency
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Open positions</p>
            <p className="mt-1 text-xl font-semibold">
              {detail.account.positionCount}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Realized result</p>
            <p className="mt-1 text-lg font-semibold">
              <SignedAmount
                value={detail.account.realizedGainNative}
                currency={detail.account.cashCurrency}
              />
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Net dividends</p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(
                detail.account.dividendsNative,
                detail.account.cashCurrency
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Recorded fees</p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(
                detail.account.feesNative,
                detail.account.cashCurrency
              )}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Positions</h2>
        {detail.account.positions.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-center text-sm text-muted-foreground">
              No open positions in this account.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {detail.account.positions.map((position) => (
              <PositionCard
                key={position.asset.id}
                position={position}
                editable={!archived}
              />
            ))}
          </div>
        )}
      </section>

      {detail.account.closedPositions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Closed positions</h2>
          <Card>
            <CardContent className="divide-y p-0">
              {detail.account.closedPositions.map((closed) => (
                <div
                  key={closed.asset.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{closed.asset.symbol}</p>
                      <Badge variant="secondary">{closed.asset.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Closed{" "}
                      {new Intl.DateTimeFormat("es-PY", {
                        dateStyle: "medium",
                      }).format(new Date(closed.lastActivityDate))}
                      {" · "}
                      Fees{" "}
                      {formatCurrency(
                        closed.feesNative,
                        closed.asset.quoteCurrency
                      )}
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Investment activity</CardTitle>
        </CardHeader>
        <CardContent>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity yet.</p>
          ) : (
            <div className="divide-y">
              {timeline.map((entry) => {
                if (entry.kind === "TRANSFER") {
                  return (
                    <div
                      key={`transfer-${entry.activity.id}`}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div>
                        <p className="font-medium">
                          {entry.activity.type === "FUNDING"
                            ? "Cash funding"
                            : "Cash withdrawal"}
                          {" · "}
                          {entry.activity.bankAccountName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Intl.DateTimeFormat("es-PY").format(
                            new Date(entry.activity.date)
                          )}
                          {" · "}
                          {formatCurrency(
                            entry.activity.amount,
                            entry.activity.currency
                          )}
                        </p>
                      </div>
                    </div>
                  );
                }

                const activity = entry.activity;
                return (
                  <div
                    key={`investment-${activity.id}`}
                    className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div>
                      <p className="font-medium">
                        {activity.type === "OPENING_POSITION"
                          ? "Opening position"
                          : activity.type}
                        {activity.assetSymbol
                          ? ` · ${activity.assetSymbol}`
                          : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {new Intl.DateTimeFormat("es-PY").format(
                          new Date(activity.date)
                        )}
                        {activity.quantity
                          ? ` · ${activity.quantity} @ ${formatCurrency(
                              activity.unitPrice,
                              activity.currency
                            )}`
                          : activity.cashAmount
                            ? ` · ${formatCurrency(
                                activity.cashAmount,
                                activity.currency
                              )}`
                            : ""}
                        {activity.fees !== "0"
                          ? ` · Fees ${formatCurrency(
                              activity.fees,
                              activity.currency
                            )}`
                          : ""}
                      </p>
                    </div>
                    {!archived &&
                      (activity.type === "OPENING_POSITION" ? (
                        <OpeningPositionForm
                          accounts={accountOptions}
                          assets={detail.assets}
                          defaultAccountId={detail.account.id}
                          activity={activity}
                        />
                      ) : (
                        <InvestmentTransactionForm
                          account={accountOptions[0]}
                          assets={detail.assets}
                          activity={activity}
                        />
                      ))}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
