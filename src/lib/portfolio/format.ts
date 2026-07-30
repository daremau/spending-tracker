/**
 * PYG has no minor unit, so it is rendered without decimals while other
 * currencies keep enough precision for fractional share and crypto values.
 */
export function formatPortfolioCurrency(
  value: string | number | null,
  currency: string,
  { maximumFractionDigits }: { maximumFractionDigits?: number } = {}
) {
  if (value === null) return "Unavailable";
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits:
      maximumFractionDigits ?? (currency === "PYG" ? 0 : 2),
  }).format(Number(value));
}

export function formatPortfolioQuantity(value: string) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 12,
  }).format(Number(value));
}

export type AmountDirection = "GAIN" | "LOSS" | "FLAT" | "UNKNOWN";

export function amountDirection(value: string | null): AmountDirection {
  if (value === null) return "UNKNOWN";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "UNKNOWN";
  if (numeric > 0) return "GAIN";
  if (numeric < 0) return "LOSS";
  return "FLAT";
}
