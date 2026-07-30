import { MarketDataError } from "./errors";

export type MarketDataConfig = {
  provider: "twelve-data";
  apiKey: string;
  timeoutMs: number;
};

export function getMarketDataConfig(
  environment: Record<string, string | undefined> = process.env
): MarketDataConfig {
  const provider = (environment.MARKET_DATA_PROVIDER ?? "twelve-data")
    .trim()
    .toLowerCase();
  if (provider !== "twelve-data") {
    throw new MarketDataError(
      "CONFIGURATION",
      "Automatic market data is not configured."
    );
  }

  const apiKey = environment.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) {
    throw new MarketDataError(
      "CONFIGURATION",
      "Add TWELVE_DATA_API_KEY to enable automatic market data."
    );
  }

  const parsedTimeout = Number(environment.MARKET_DATA_TIMEOUT_MS ?? "8000");
  const timeoutMs =
    Number.isInteger(parsedTimeout) &&
    parsedTimeout >= 1000 &&
    parsedTimeout <= 30000
      ? parsedTimeout
      : 8000;

  return { provider: "twelve-data", apiKey, timeoutMs };
}
