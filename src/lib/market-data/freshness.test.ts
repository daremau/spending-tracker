import { describe, expect, it } from "vitest";
import {
  FRESHNESS_THRESHOLDS_MS,
  fxRateIsFresh,
  quoteFreshness,
} from "./freshness";

const now = new Date("2026-07-29T12:00:00.000Z");

describe("market-data freshness", () => {
  it("keeps manual and fallback labels independent of age", () => {
    expect(
      quoteFreshness({
        source: "MANUAL",
        assetType: "STOCK",
        asOf: "2020-01-01T00:00:00.000Z",
        now,
      })
    ).toBe("MANUAL");
    expect(
      quoteFreshness({
        source: "TRANSACTION_FALLBACK",
        assetType: "STOCK",
        asOf: "2026-07-29T11:00:00.000Z",
        now,
      })
    ).toBe("FALLBACK");
  });

  it("evaluates stock and crypto threshold boundaries", () => {
    expect(
      quoteFreshness({
        source: "PROVIDER",
        assetType: "STOCK",
        asOf: new Date(now.getTime() - FRESHNESS_THRESHOLDS_MS.STOCK),
        now,
      })
    ).toBe("FRESH");
    expect(
      quoteFreshness({
        source: "PROVIDER",
        assetType: "STOCK",
        asOf: new Date(now.getTime() - FRESHNESS_THRESHOLDS_MS.STOCK - 1),
        now,
      })
    ).toBe("STALE");
    expect(
      quoteFreshness({
        source: "PROVIDER",
        assetType: "CRYPTO",
        asOf: new Date(now.getTime() - FRESHNESS_THRESHOLDS_MS.CRYPTO - 1),
        now,
      })
    ).toBe("STALE");
  });

  it("evaluates FX and unavailable values", () => {
    expect(
      fxRateIsFresh(
        new Date(now.getTime() - FRESHNESS_THRESHOLDS_MS.FX),
        now
      )
    ).toBe(true);
    expect(
      fxRateIsFresh(
        new Date(now.getTime() - FRESHNESS_THRESHOLDS_MS.FX - 1),
        now
      )
    ).toBe(false);
    expect(
      quoteFreshness({
        source: "UNAVAILABLE",
        assetType: "ETF",
        asOf: null,
        now,
      })
    ).toBe("UNAVAILABLE");
  });
});
