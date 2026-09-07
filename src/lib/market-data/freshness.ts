import type { MarketAssetType } from "./types";

export type QuoteFreshness =
  | "MANUAL"
  | "FRESH"
  | "STALE"
  | "FALLBACK"
  | "UNAVAILABLE";

export const FRESHNESS_THRESHOLDS_MS = {
  STOCK: 24 * 60 * 60 * 1000,
  ETF: 24 * 60 * 60 * 1000,
  CRYPTO: 15 * 60 * 1000,
  FX: 24 * 60 * 60 * 1000,
} as const;

export function isFresh(
  asOf: Date | string,
  thresholdMs: number,
  now: Date = new Date()
) {
  const timestamp = new Date(asOf).getTime();
  if (!Number.isFinite(timestamp)) return false;
  return Math.max(0, now.getTime() - timestamp) <= thresholdMs;
}

export function quoteFreshness(input: {
  source: "MANUAL" | "PROVIDER" | "TRANSACTION_FALLBACK" | "UNAVAILABLE";
  assetType: MarketAssetType;
  asOf: Date | string | null;
  now?: Date;
}): QuoteFreshness {
  if (input.source === "MANUAL") return "MANUAL";
  if (input.source === "TRANSACTION_FALLBACK") return "FALLBACK";
  if (input.source === "UNAVAILABLE" || !input.asOf) return "UNAVAILABLE";
  return isFresh(
    input.asOf,
    FRESHNESS_THRESHOLDS_MS[input.assetType],
    input.now
  )
    ? "FRESH"
    : "STALE";
}

export function fxRateIsFresh(asOf: Date | string, now: Date = new Date()) {
  return isFresh(asOf, FRESHNESS_THRESHOLDS_MS.FX, now);
}
