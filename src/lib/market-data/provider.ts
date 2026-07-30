import { getMarketDataConfig } from "./config";
import type { MarketDataProvider } from "./types";
import { TwelveDataProvider } from "./twelve-data";

export function getMarketDataProvider(): MarketDataProvider {
  const config = getMarketDataConfig();
  return new TwelveDataProvider({
    apiKey: config.apiKey,
    timeoutMs: config.timeoutMs,
  });
}
