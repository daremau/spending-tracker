import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PortfolioPositionDto } from "@/lib/portfolio/dtos";
import { ManualQuoteForm } from "./manual-quote-form";

function formatCurrency(value: string | null, currency: string) {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PYG" ? 0 : 8,
  }).format(Number(value));
}

function formatQuantity(value: string) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 12,
  }).format(Number(value));
}

export function PositionCard({
  position,
  editable = true,
}: {
  position: PortfolioPositionDto;
  editable?: boolean;
}) {
  const gain = position.unrealizedGainNative
    ? Number(position.unrealizedGainNative)
    : null;

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{position.asset.symbol}</h3>
              <Badge variant="secondary">{position.asset.type}</Badge>
              <Badge variant="outline">
                {position.quote.source === "MANUAL"
                  ? "Manual price"
                  : position.quote.source === "FALLBACK"
                    ? "Transaction fallback"
                    : "Price unavailable"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {position.asset.name} · {position.asset.market}
            </p>
          </div>
          {editable && (
            <ManualQuoteForm
              asset={position.asset}
              currentPrice={position.quote.price}
              manualQuoteId={position.quote.manualQuoteId}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-muted-foreground">Quantity</p>
            <p className="font-medium">{formatQuantity(position.quantity)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Average cost</p>
            <p className="font-medium">
              {formatCurrency(
                position.averageCostNative,
                position.asset.quoteCurrency
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Market value</p>
            <p className="font-medium">
              {formatCurrency(
                position.marketValueNative,
                position.asset.quoteCurrency
              )}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Unrealized</p>
            <p
              className={
                gain === null
                  ? "font-medium"
                  : gain >= 0
                    ? "font-medium text-green-600"
                    : "font-medium text-red-500"
              }
            >
              {gain !== null && gain > 0 ? "+" : ""}
              {formatCurrency(
                position.unrealizedGainNative,
                position.asset.quoteCurrency
              )}
            </p>
          </div>
        </div>

        {!position.reportingComplete && position.missingRates.length > 0 && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Reporting value unavailable: add{" "}
            {position.missingRates.join(", ")} in Currency settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
