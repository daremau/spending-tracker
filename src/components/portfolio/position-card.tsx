import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { PortfolioPositionDto } from "@/lib/portfolio/dtos";
import {
  formatPortfolioCurrency,
  formatPortfolioQuantity,
} from "@/lib/portfolio/format";
import { ManualQuoteForm } from "./manual-quote-form";
import { QuoteStatus } from "./quote-status";
import { SignedAmount } from "./signed-amount";

function formatCurrency(value: string | null, currency: string) {
  return formatPortfolioCurrency(value, currency, {
    maximumFractionDigits: currency === "PYG" ? 0 : 8,
  });
}

export function PositionCard({
  position,
  editable = true,
}: {
  position: PortfolioPositionDto;
  editable?: boolean;
}) {
  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{position.asset.symbol}</h3>
              <Badge variant="secondary">{position.asset.type}</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {position.asset.name} · {position.asset.market}
            </p>
            <div className="mt-2">
              <QuoteStatus quote={position.quote} />
            </div>
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
            <p className="font-medium">
              {formatPortfolioQuantity(position.quantity)}
            </p>
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
            <SignedAmount
              value={position.unrealizedGainNative}
              currency={position.asset.quoteCurrency}
              className="font-medium"
            />
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
