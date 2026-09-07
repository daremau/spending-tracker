import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { amountDirection, formatPortfolioCurrency } from "@/lib/portfolio/format";

const DIRECTION = {
  GAIN: {
    icon: ArrowUpRight,
    className: "text-green-600 dark:text-green-500",
    word: "gain",
  },
  LOSS: {
    icon: ArrowDownRight,
    className: "text-red-600 dark:text-red-500",
    word: "loss",
  },
  FLAT: { icon: Minus, className: "", word: "no change" },
  UNKNOWN: { icon: Minus, className: "text-muted-foreground", word: "unavailable" },
} as const;

/**
 * Renders a gain or loss with an arrow and an explicit sign so the direction
 * never depends on color alone.
 */
export function SignedAmount({
  value,
  currency,
  className,
}: {
  value: string | null;
  currency: string;
  className?: string;
}) {
  const direction = amountDirection(value);
  const { icon: Icon, className: tone, word } = DIRECTION[direction];
  const formatted = formatPortfolioCurrency(value, currency);
  const label =
    direction === "UNKNOWN" ? "Unavailable" : `${formatted} ${word}`;

  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", tone, className)}
      aria-label={label}
    >
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span aria-hidden="true">
        {direction === "GAIN" ? "+" : ""}
        {formatted}
      </span>
    </span>
  );
}
