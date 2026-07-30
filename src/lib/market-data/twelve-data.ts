import Decimal from "decimal.js";
import { MarketDataError } from "./errors";
import type {
  AssetSearchResult,
  CurrencyPair,
  MarketAssetType,
  MarketDataProvider,
  ProviderAssetRef,
  ProviderBatchResult,
  ProviderExchangeRate,
  ProviderFailure,
  ProviderQuote,
} from "./types";

type FetchImplementation = typeof fetch;
type Logger = Pick<Console, "info" | "warn">;

type TwelveDataProviderOptions = {
  apiKey: string;
  timeoutMs?: number;
  fetchImpl?: FetchImplementation;
  logger?: Logger;
  baseUrl?: string;
};

const BATCH_SIZE = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedAssetType(value: unknown): MarketAssetType | null {
  if (typeof value !== "string") return null;
  const type = value.trim().toUpperCase();
  if (type === "ETF" || type.includes("EXCHANGE-TRADED FUND")) return "ETF";
  if (
    type.includes("DIGITAL CURRENCY") ||
    type.includes("CRYPTO") ||
    type.includes("VIRTUAL CURRENCY")
  ) {
    return "CRYPTO";
  }
  if (
    type.includes("STOCK") ||
    type.includes("COMMON") ||
    type.includes("EQUITY") ||
    type.includes("DEPOSITARY RECEIPT") ||
    type.includes("REIT")
  ) {
    return "STOCK";
  }
  return null;
}

function positiveDecimal(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return null;
  try {
    const decimal = new Decimal(value);
    return decimal.isFinite() && decimal.greaterThan(0)
      ? decimal.toString()
      : null;
  } catch {
    return null;
  }
}

function providerDate(record: Record<string, unknown>) {
  if (
    (typeof record.timestamp === "number" ||
      typeof record.timestamp === "string") &&
    Number.isFinite(Number(record.timestamp))
  ) {
    const date = new Date(Number(record.timestamp) * 1000);
    if (!Number.isNaN(date.getTime())) return date;
  }
  if (typeof record.datetime === "string") {
    const utcValue = record.datetime.includes("T")
      ? record.datetime
      : `${record.datetime.replace(" ", "T")}Z`;
    const date = new Date(utcValue);
    if (!Number.isNaN(date.getTime())) return date;
  }
  return null;
}

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function providerErrorFromPayload(
  status: number,
  payload: unknown
): MarketDataError | null {
  const record = isRecord(payload) ? payload : null;
  const providerStatus = record?.status;
  const providerCode = Number(record?.code);
  const failed =
    status >= 400 ||
    providerStatus === "error" ||
    (Number.isFinite(providerCode) && providerCode >= 400);
  if (!failed) return null;

  const code = status >= 400 ? status : providerCode;
  if (code === 429) {
    return new MarketDataError(
      "QUOTA",
      "Market-data quota reached. Cached values were kept."
    );
  }
  if (code === 401 || code === 403) {
    return new MarketDataError(
      "AUTHENTICATION",
      "Market-data authentication failed. Check the server configuration."
    );
  }
  if (code >= 400 && code < 500) {
    return new MarketDataError(
      "INVALID_REQUEST",
      "The market-data provider rejected this request."
    );
  }
  return new MarketDataError(
    "PROVIDER",
    "The market-data provider is temporarily unavailable. Cached values were kept.",
    true
  );
}

export class TwelveDataProvider implements MarketDataProvider {
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: FetchImplementation;
  private readonly logger: Logger;
  private readonly baseUrl: string;

  constructor(options: TwelveDataProviderOptions) {
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 8000;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.logger = options.logger ?? console;
    this.baseUrl = options.baseUrl ?? "https://api.twelvedata.com";
  }

  private async request(
    endpoint: string,
    parameters: Record<string, string>
  ): Promise<unknown> {
    const url = new URL(endpoint, this.baseUrl);
    for (const [key, value] of Object.entries(parameters)) {
      url.searchParams.set(key, value);
    }

    const maxAttempts = 2;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
      const startedAt = Date.now();
      try {
        const response = await this.fetchImpl(url, {
          headers: { Authorization: `apikey ${this.apiKey}` },
          signal: controller.signal,
          cache: "no-store",
        });
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          throw new MarketDataError(
            "PROVIDER",
            "The market-data provider returned an invalid response."
          );
        }

        const providerError = providerErrorFromPayload(response.status, payload);
        if (providerError) throw providerError;
        this.logger.info("market-data request", {
          provider: "twelve-data",
          endpoint,
          status: response.status,
          durationMs: Date.now() - startedAt,
        });
        return payload;
      } catch (error) {
        const aborted =
          controller.signal.aborted ||
          (error instanceof Error && error.name === "AbortError");
        const normalized = aborted
          ? new MarketDataError(
              "TIMEOUT",
              "Market data timed out. Cached values were kept.",
              true
            )
          : error instanceof MarketDataError
            ? error
            : new MarketDataError(
                "NETWORK",
                "Market data could not be reached. Cached values were kept.",
                true
              );

        if (!normalized.retryable || attempt === maxAttempts) {
          this.logger.warn("market-data request failed", {
            provider: "twelve-data",
            endpoint,
            code: normalized.code,
            durationMs: Date.now() - startedAt,
          });
          throw normalized;
        }
      } finally {
        clearTimeout(timeout);
      }
    }
    throw new MarketDataError("PROVIDER", "Market data is unavailable.");
  }

  async searchAssets(
    query: string,
    type?: MarketAssetType
  ): Promise<AssetSearchResult[]> {
    const payload = await this.request("/symbol_search", {
      symbol: query,
      outputsize: "20",
      show_plan: "false",
    });
    if (!isRecord(payload) || !Array.isArray(payload.data)) {
      throw new MarketDataError(
        "PROVIDER",
        "The market-data provider returned an invalid search response."
      );
    }

    const results: AssetSearchResult[] = [];
    for (const value of payload.data) {
      if (!isRecord(value)) continue;
      const assetType = normalizedAssetType(value.instrument_type);
      const providerSymbol =
        typeof value.symbol === "string" ? value.symbol.trim() : "";
      const name =
        typeof value.instrument_name === "string"
          ? value.instrument_name.trim()
          : "";
      const marketValue =
        typeof value.mic_code === "string" && value.mic_code.trim()
          ? value.mic_code
          : value.exchange;
      const market =
        typeof marketValue === "string" ? marketValue.trim().toUpperCase() : "";
      const currency =
        typeof value.currency === "string"
          ? value.currency.trim().toUpperCase()
          : "";
      if (
        !assetType ||
        (type && type !== assetType) ||
        !providerSymbol ||
        !name ||
        !market ||
        !/^[A-Z]{3}$/.test(currency)
      ) {
        continue;
      }
      results.push({
        provider: "TWELVE_DATA",
        providerSymbol,
        symbol: providerSymbol.toUpperCase(),
        name,
        market,
        type: assetType,
        quoteCurrency: currency,
        country:
          typeof value.country === "string" && value.country.trim()
            ? value.country.trim()
            : null,
      });
    }
    return results.slice(0, 12);
  }

  async getQuotes(
    assets: ProviderAssetRef[]
  ): Promise<ProviderBatchResult<ProviderQuote>> {
    const values: ProviderQuote[] = [];
    const failures: ProviderFailure[] = [];

    for (const batch of chunks(assets, BATCH_SIZE)) {
      if (batch.length === 0) continue;
      const valuesBeforeBatch = values.length;
      const payload = await this.request("/quote", {
        symbol: batch.map((asset) => asset.providerSymbol).join(","),
        timezone: "UTC",
        dp: "8",
      });
      for (const asset of batch) {
        const record: Record<string, unknown> | null =
          batch.length === 1 && isRecord(payload) && "close" in payload
            ? payload
            : isRecord(payload) && isRecord(payload[asset.providerSymbol])
              ? (payload[asset.providerSymbol] as Record<string, unknown>)
              : null;
        const error = providerErrorFromPayload(200, record);
        if (!record || error) {
          failures.push({
            key: asset.providerSymbol,
            code: "NOT_FOUND",
            message: "No valid quote was returned.",
          });
          continue;
        }
        const price = positiveDecimal(record.close);
        const currency =
          typeof record.currency === "string"
            ? record.currency.trim().toUpperCase()
            : "";
        const asOf = providerDate(record);
        if (!price || currency !== asset.quoteCurrency || !asOf) {
          failures.push({
            key: asset.providerSymbol,
            code: "INVALID_RESPONSE",
            message: "Quote price, currency, or timestamp was invalid.",
          });
          continue;
        }
        values.push({
          assetId: asset.assetId,
          providerSymbol: asset.providerSymbol,
          price,
          currency,
          asOf,
        });
      }
      this.logger.info("market-data batch", {
        provider: "twelve-data",
        endpoint: "/quote",
        requested: batch.length,
        successful: values.length - valuesBeforeBatch,
      });
    }
    return { values, failures };
  }

  async getExchangeRates(
    pairs: CurrencyPair[]
  ): Promise<ProviderBatchResult<ProviderExchangeRate>> {
    const values: ProviderExchangeRate[] = [];
    const failures: ProviderFailure[] = [];

    for (const batch of chunks(pairs, BATCH_SIZE)) {
      if (batch.length === 0) continue;
      const valuesBeforeBatch = values.length;
      const symbols = batch.map(
        (pair) => `${pair.fromCurrency}/${pair.toCurrency}`
      );
      const payload = await this.request("/exchange_rate", {
        symbol: symbols.join(","),
        timezone: "UTC",
        dp: "10",
      });
      for (const [index, pair] of batch.entries()) {
        const symbol = symbols[index];
        const record: Record<string, unknown> | null =
          batch.length === 1 && isRecord(payload) && "rate" in payload
            ? payload
            : isRecord(payload) && isRecord(payload[symbol])
              ? (payload[symbol] as Record<string, unknown>)
              : null;
        const error = providerErrorFromPayload(200, record);
        if (!record || error) {
          failures.push({
            key: symbol,
            code: "NOT_FOUND",
            message: "No valid exchange rate was returned.",
          });
          continue;
        }
        const rate = positiveDecimal(record.rate);
        const asOf = providerDate(record);
        if (!rate || !asOf) {
          failures.push({
            key: symbol,
            code: "INVALID_RESPONSE",
            message: "Exchange-rate value or timestamp was invalid.",
          });
          continue;
        }
        values.push({ ...pair, rate, asOf });
      }
      this.logger.info("market-data batch", {
        provider: "twelve-data",
        endpoint: "/exchange_rate",
        requested: batch.length,
        successful: values.length - valuesBeforeBatch,
      });
    }
    return { values, failures };
  }
}
