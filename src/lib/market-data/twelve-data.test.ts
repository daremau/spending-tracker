import { describe, expect, it, vi } from "vitest";
import { MarketDataError } from "./errors";
import { TwelveDataProvider } from "./twelve-data";

const logger = { info: vi.fn(), warn: vi.fn() };

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function provider(fetchImpl: typeof fetch) {
  return new TwelveDataProvider({
    apiKey: "super-secret-key",
    timeoutMs: 1000,
    fetchImpl,
    logger,
  });
}

describe("Twelve Data provider", () => {
  it("normalizes stock, ETF, and crypto search results", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        data: [
          {
            symbol: "AAPL",
            instrument_name: "Apple Inc",
            exchange: "NASDAQ",
            mic_code: "XNAS",
            instrument_type: "Common Stock",
            country: "United States",
            currency: "USD",
          },
          {
            symbol: "SPY",
            instrument_name: "SPDR S&P 500 ETF",
            exchange: "NYSE Arca",
            mic_code: "ARCX",
            instrument_type: "ETF",
            country: "United States",
            currency: "USD",
          },
          {
            symbol: "BTC/USD",
            instrument_name: "Bitcoin / US Dollar",
            exchange: "Coinbase",
            instrument_type: "Digital Currency",
            currency: "USD",
          },
          {
            symbol: "BAD",
            instrument_name: "Invalid",
            exchange: "TEST",
            instrument_type: "Bond",
            currency: "USD",
          },
        ],
        status: "ok",
      })
    ) as unknown as typeof fetch;

    const results = await provider(fetchImpl).searchAssets("a");
    expect(results.map((result) => result.type)).toEqual([
      "STOCK",
      "ETF",
      "CRYPTO",
    ]);
    expect(results[0]).toMatchObject({
      providerSymbol: "AAPL",
      symbol: "AAPL",
      market: "XNAS",
      quoteCurrency: "USD",
    });
    expect(results[2]).toMatchObject({
      providerSymbol: "BTC/USD",
      market: "COINBASE",
    });
  });

  it("batches quotes and preserves valid partial results", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        AAPL: {
          symbol: "AAPL",
          close: "201.25000000",
          currency: "USD",
          timestamp: 1785326400,
        },
        BAD: {
          symbol: "BAD",
          close: "-1",
          currency: "USD",
          timestamp: 1785326400,
        },
        "BTC/USD": {
          code: 404,
          status: "error",
          message: "not found",
        },
      })
    ) as unknown as typeof fetch;

    const result = await provider(fetchImpl).getQuotes([
      {
        assetId: "apple",
        providerSymbol: "AAPL",
        type: "STOCK",
        quoteCurrency: "USD",
      },
      {
        assetId: "bad",
        providerSymbol: "BAD",
        type: "STOCK",
        quoteCurrency: "USD",
      },
      {
        assetId: "bitcoin",
        providerSymbol: "BTC/USD",
        type: "CRYPTO",
        quoteCurrency: "USD",
      },
    ]);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result.values).toHaveLength(1);
    expect(result.values[0]).toMatchObject({
      assetId: "apple",
      price: "201.25",
      currency: "USD",
    });
    expect(result.failures.map((failure) => failure.key)).toEqual([
      "BAD",
      "BTC/USD",
    ]);
  });

  it("normalizes FX while keeping the key out of the URL", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        symbol: "USD/PYG",
        rate: 7500.25,
        timestamp: 1785326400,
      })
    ) as unknown as typeof fetch;

    const result = await provider(fetchImpl).getExchangeRates([
      { fromCurrency: "USD", toCurrency: "PYG" },
    ]);
    expect(result.values[0]).toMatchObject({
      fromCurrency: "USD",
      toCurrency: "PYG",
      rate: "7500.25",
    });

    const [url, options] = vi.mocked(fetchImpl).mock.calls[0];
    expect(String(url)).not.toContain("super-secret-key");
    expect(
      (options?.headers as Record<string, string>).Authorization
    ).toBe("apikey super-secret-key");
  });

  it("normalizes quota errors without retrying", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        { code: 429, status: "error", message: "quota exhausted" },
        429
      )
    ) as unknown as typeof fetch;

    await expect(provider(fetchImpl).searchAssets("AAPL")).rejects.toMatchObject({
      code: "QUOTA",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries one transient server failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          { code: 500, status: "error", message: "internal" },
          500
        )
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: [],
          status: "ok",
        })
      ) as unknown as typeof fetch;

    await expect(provider(fetchImpl).searchAssets("AAPL")).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns sanitized network failures", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("request included super-secret-key");
    }) as unknown as typeof fetch;

    await expect(provider(fetchImpl).searchAssets("AAPL")).rejects.toEqual(
      expect.objectContaining<Partial<MarketDataError>>({
        code: "NETWORK",
        message: "Market data could not be reached. Cached values were kept.",
      })
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
