export type MarketDataErrorCode =
  | "CONFIGURATION"
  | "TIMEOUT"
  | "QUOTA"
  | "AUTHENTICATION"
  | "INVALID_REQUEST"
  | "NETWORK"
  | "PROVIDER";

export class MarketDataError extends Error {
  constructor(
    public readonly code: MarketDataErrorCode,
    message: string,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "MarketDataError";
  }
}

export function publicMarketDataError(error: unknown) {
  if (error instanceof MarketDataError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "PROVIDER" as const,
    message: "Market data is temporarily unavailable. Cached values were kept.",
  };
}
