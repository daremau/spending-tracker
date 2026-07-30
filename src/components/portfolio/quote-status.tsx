import { Badge } from "@/components/ui/badge";
import type { PortfolioPositionDto } from "@/lib/portfolio/dtos";

const labels: Record<
  PortfolioPositionDto["quote"]["freshness"],
  string
> = {
  MANUAL: "Manual price",
  FRESH: "Fresh provider price",
  STALE: "Stale provider price",
  FALLBACK: "Transaction fallback",
  UNAVAILABLE: "Price unavailable",
};

export function QuoteStatus({
  quote,
}: {
  quote: PortfolioPositionDto["quote"];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        variant={
          quote.freshness === "STALE" || quote.freshness === "UNAVAILABLE"
            ? "destructive"
            : "outline"
        }
      >
        {labels[quote.freshness]}
      </Badge>
      {quote.asOf && (
        <span className="text-xs text-muted-foreground">
          As of{" "}
          {new Intl.DateTimeFormat("es-PY", {
            dateStyle: "medium",
            timeStyle: "short",
          }).format(new Date(quote.asOf))}
        </span>
      )}
    </div>
  );
}
