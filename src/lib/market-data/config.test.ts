import { describe, expect, it } from "vitest";
import { MarketDataError } from "./errors";
import { getMarketDataConfig } from "./config";

describe("market-data configuration", () => {
  it("loads server-only provider settings and bounds timeout", () => {
    expect(
      getMarketDataConfig({
        MARKET_DATA_PROVIDER: "twelve-data",
        TWELVE_DATA_API_KEY: "secret",
        MARKET_DATA_TIMEOUT_MS: "4500",
      })
    ).toEqual({
      provider: "twelve-data",
      apiKey: "secret",
      timeoutMs: 4500,
    });
    expect(
      getMarketDataConfig({
        TWELVE_DATA_API_KEY: "secret",
        MARKET_DATA_TIMEOUT_MS: "999999",
      }).timeoutMs
    ).toBe(8000);
  });

  it("rejects missing credentials without including a secret", () => {
    expect(() => getMarketDataConfig({})).toThrow(MarketDataError);
    expect(() => getMarketDataConfig({ MARKET_DATA_PROVIDER: "other" })).toThrow(
      "Automatic market data is not configured"
    );
  });
});
