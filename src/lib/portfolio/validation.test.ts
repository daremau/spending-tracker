import { describe, expect, it } from "vitest";
import {
  manualAssetSchema,
  openingPositionSchema,
} from "./validation";

describe("manual portfolio validation", () => {
  it("normalizes stock identity", () => {
    expect(
      manualAssetSchema.parse({
        type: "STOCK",
        symbol: "aapl",
        name: "Apple",
        market: "nasdaq",
        quoteCurrency: "usd",
      })
    ).toMatchObject({ symbol: "AAPL", market: "NASDAQ", quoteCurrency: "USD" });
  });

  it("retains a crypto pair symbol", () => {
    expect(
      manualAssetSchema.parse({
        type: "CRYPTO",
        symbol: "btc/usd",
        name: "Bitcoin",
        market: "crypto",
        quoteCurrency: "USD",
      }).symbol
    ).toBe("BTC/USD");
  });

  it("accepts twelve quantity decimals and rejects a thirteenth", () => {
    const base = {
      clientRequestId: "8e702b4e-7cf2-44de-b19e-855f614dc450",
      accountId: "account",
      assetId: "asset",
      unitPrice: "60000.12345678",
      fees: "0",
      fxRateToReporting: "7500",
      date: "2026-01-01",
    };

    expect(
      openingPositionSchema.safeParse({
        ...base,
        quantity: "0.123456789012",
      }).success
    ).toBe(true);
    expect(
      openingPositionSchema.safeParse({
        ...base,
        quantity: "0.1234567890123",
      }).success
    ).toBe(false);
  });
});
