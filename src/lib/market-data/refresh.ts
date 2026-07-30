import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { replayLedger } from "@/lib/portfolio/calculations";
import { publicMarketDataError } from "./errors";
import {
  FRESHNESS_THRESHOLDS_MS,
  fxRateIsFresh,
  isFresh,
} from "./freshness";
import { getMarketDataProvider } from "./provider";
import type {
  CurrencyPair,
  MarketDataProvider,
  ProviderAssetRef,
} from "./types";

const SETTINGS_ID = "singleton";
const PROVIDER_NAME = "TWELVE_DATA";

export type MarketRefreshFailure = {
  stage: "QUOTE" | "FX";
  key: string;
  code: string;
  message: string;
};

export type MarketRefreshSummary = {
  quotes: {
    requested: number;
    updated: number;
    skippedManual: number;
    skippedFresh: number;
    skippedUnlinked: number;
  };
  rates: {
    requested: number;
    updated: number;
    skippedManual: number;
    skippedFresh: number;
  };
  failures: MarketRefreshFailure[];
};

type RefreshOptions = {
  now?: Date;
  provider?: MarketDataProvider;
};

function ledgerInput(transaction: {
  id: string;
  type: "OPENING_POSITION" | "BUY" | "SELL" | "DIVIDEND" | "FEE";
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  cashAmount: Prisma.Decimal | null;
  fees: Prisma.Decimal;
  fxRateToReporting: Prisma.Decimal;
  date: Date;
  createdAt: Date;
}) {
  return {
    id: transaction.id,
    type: transaction.type,
    quantity: transaction.quantity?.toString() ?? null,
    unitPrice: transaction.unitPrice?.toString() ?? null,
    cashAmount: transaction.cashAmount?.toString() ?? null,
    fees: transaction.fees.toString(),
    fxRateToReporting: transaction.fxRateToReporting.toString(),
    date: transaction.date,
    createdAt: transaction.createdAt,
  };
}

async function loadRefreshCandidates(now: Date) {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      reportingCurrency: "PYG",
      timezone: "America/Asuncion",
    },
  });
  const [transactions, bankCurrencies, rates] = await Promise.all([
    prisma.investmentTransaction.findMany({
      where: {
        account: { archivedAt: null },
        assetId: { not: null },
      },
      include: {
        asset: { include: { marketQuotes: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
    }),
    prisma.bankAccount.findMany({
      select: { currency: true },
      distinct: ["currency"],
    }),
    prisma.exchangeRate.findMany({
      where: {
        active: true,
        toCurrency: settings.reportingCurrency,
      },
    }),
  ]);

  const grouped = new Map<string, typeof transactions>();
  for (const transaction of transactions) {
    if (!transaction.assetId || !transaction.asset) continue;
    const key = `${transaction.accountId}:${transaction.assetId}`;
    const current = grouped.get(key) ?? [];
    current.push(transaction);
    grouped.set(key, current);
  }

  const openAssets = new Map<
    string,
    NonNullable<(typeof transactions)[number]["asset"]>
  >();
  for (const ledger of grouped.values()) {
    const state = replayLedger(ledger.map(ledgerInput));
    const asset = ledger[0]?.asset;
    if (asset && new Prisma.Decimal(state.quantity).greaterThan(0)) {
      openAssets.set(asset.id, asset);
    }
  }

  const quoteCandidates: ProviderAssetRef[] = [];
  let skippedManualQuotes = 0;
  let skippedFreshQuotes = 0;
  let skippedUnlinkedQuotes = 0;
  for (const asset of openAssets.values()) {
    const manualQuote = asset.marketQuotes.find(
      (quote) => quote.source === "MANUAL" && quote.active
    );
    if (manualQuote) {
      skippedManualQuotes += 1;
      continue;
    }
    if (asset.provider !== PROVIDER_NAME || !asset.providerSymbol) {
      skippedUnlinkedQuotes += 1;
      continue;
    }
    const providerQuote = asset.marketQuotes.find(
      (quote) => quote.source === "TWELVE_DATA" && quote.active
    );
    if (
      providerQuote &&
      isFresh(
        providerQuote.fetchedAt,
        FRESHNESS_THRESHOLDS_MS[asset.type],
        now
      )
    ) {
      skippedFreshQuotes += 1;
      continue;
    }
    quoteCandidates.push({
      assetId: asset.id,
      providerSymbol: asset.providerSymbol,
      type: asset.type,
      quoteCurrency: asset.quoteCurrency,
    });
  }

  const currencies = Array.from(
    new Set(
      bankCurrencies
        .map((account) => account.currency)
        .filter((currency) => currency !== settings.reportingCurrency)
    )
  ).sort();
  const rateCandidates: CurrencyPair[] = [];
  let skippedManualRates = 0;
  let skippedFreshRates = 0;
  for (const currency of currencies) {
    const pairRates = rates.filter(
      (rate) =>
        rate.fromCurrency === currency &&
        rate.toCurrency === settings.reportingCurrency
    );
    if (pairRates.some((rate) => rate.source === "MANUAL")) {
      skippedManualRates += 1;
      continue;
    }
    const providerRate = pairRates.find(
      (rate) => rate.source === "TWELVE_DATA"
    );
    if (providerRate && fxRateIsFresh(providerRate.fetchedAt, now)) {
      skippedFreshRates += 1;
      continue;
    }
    rateCandidates.push({
      fromCurrency: currency,
      toCurrency: settings.reportingCurrency,
    });
  }

  return {
    quoteCandidates,
    rateCandidates,
    skippedManualQuotes,
    skippedFreshQuotes,
    skippedUnlinkedQuotes,
    skippedManualRates,
    skippedFreshRates,
  };
}

export async function refreshPortfolioMarketData(
  options: RefreshOptions = {}
): Promise<MarketRefreshSummary> {
  const now = options.now ?? new Date();
  const candidates = await loadRefreshCandidates(now);
  const summary: MarketRefreshSummary = {
    quotes: {
      requested: candidates.quoteCandidates.length,
      updated: 0,
      skippedManual: candidates.skippedManualQuotes,
      skippedFresh: candidates.skippedFreshQuotes,
      skippedUnlinked: candidates.skippedUnlinkedQuotes,
    },
    rates: {
      requested: candidates.rateCandidates.length,
      updated: 0,
      skippedManual: candidates.skippedManualRates,
      skippedFresh: candidates.skippedFreshRates,
    },
    failures: [],
  };

  if (
    candidates.quoteCandidates.length === 0 &&
    candidates.rateCandidates.length === 0
  ) {
    return summary;
  }

  let provider: MarketDataProvider;
  let blockRemainingRequests = false;
  try {
    provider = options.provider ?? getMarketDataProvider();
  } catch (error) {
    const safe = publicMarketDataError(error);
    for (const quote of candidates.quoteCandidates) {
      summary.failures.push({
        stage: "QUOTE",
        key: quote.providerSymbol,
        ...safe,
      });
    }
    for (const pair of candidates.rateCandidates) {
      summary.failures.push({
        stage: "FX",
        key: `${pair.fromCurrency}/${pair.toCurrency}`,
        ...safe,
      });
    }
    return summary;
  }

  if (candidates.quoteCandidates.length > 0) {
    try {
      const quoteResult = await provider.getQuotes(
        candidates.quoteCandidates
      );
      const requested = new Map(
        candidates.quoteCandidates.map((asset) => [asset.assetId, asset])
      );
      const validQuotes = quoteResult.values.filter((quote) => {
        const asset = requested.get(quote.assetId);
        return asset && asset.quoteCurrency === quote.currency;
      });
      if (validQuotes.length > 0) {
        await prisma.$transaction(
          validQuotes.map((quote) =>
            prisma.marketQuote.upsert({
              where: {
                assetId_source: {
                  assetId: quote.assetId,
                  source: "TWELVE_DATA",
                },
              },
              update: {
                price: quote.price,
                currency: quote.currency,
                asOf: quote.asOf,
                fetchedAt: now,
                active: true,
              },
              create: {
                assetId: quote.assetId,
                source: "TWELVE_DATA",
                price: quote.price,
                currency: quote.currency,
                asOf: quote.asOf,
                fetchedAt: now,
                active: true,
              },
            })
          )
        );
      }
      summary.quotes.updated = validQuotes.length;
      summary.failures.push(
        ...quoteResult.failures.map((failure) => ({
          stage: "QUOTE" as const,
          ...failure,
        }))
      );
    } catch (error) {
      const safe = publicMarketDataError(error);
      blockRemainingRequests = [
        "QUOTA",
        "AUTHENTICATION",
        "CONFIGURATION",
      ].includes(safe.code);
      summary.failures.push(
        ...candidates.quoteCandidates.map((quote) => ({
          stage: "QUOTE" as const,
          key: quote.providerSymbol,
          ...safe,
        }))
      );
    }
  }

  if (candidates.rateCandidates.length > 0 && blockRemainingRequests) {
    const safe = {
      code: "PROVIDER",
      message:
        "FX refresh was skipped after the provider rejected the quote request. Cached values were kept.",
    };
    summary.failures.push(
      ...candidates.rateCandidates.map((pair) => ({
        stage: "FX" as const,
        key: `${pair.fromCurrency}/${pair.toCurrency}`,
        ...safe,
      }))
    );
  } else if (candidates.rateCandidates.length > 0) {
    try {
      const rateResult = await provider.getExchangeRates(
        candidates.rateCandidates
      );
      if (rateResult.values.length > 0) {
        await prisma.$transaction(
          rateResult.values.map((rate) =>
            prisma.exchangeRate.upsert({
              where: {
                fromCurrency_toCurrency_source: {
                  fromCurrency: rate.fromCurrency,
                  toCurrency: rate.toCurrency,
                  source: "TWELVE_DATA",
                },
              },
              update: {
                rate: rate.rate,
                asOf: rate.asOf,
                fetchedAt: now,
                active: true,
              },
              create: {
                fromCurrency: rate.fromCurrency,
                toCurrency: rate.toCurrency,
                source: "TWELVE_DATA",
                rate: rate.rate,
                asOf: rate.asOf,
                fetchedAt: now,
                active: true,
              },
            })
          )
        );
      }
      summary.rates.updated = rateResult.values.length;
      summary.failures.push(
        ...rateResult.failures.map((failure) => ({
          stage: "FX" as const,
          ...failure,
        }))
      );
    } catch (error) {
      const safe = publicMarketDataError(error);
      summary.failures.push(
        ...candidates.rateCandidates.map((pair) => ({
          stage: "FX" as const,
          key: `${pair.fromCurrency}/${pair.toCurrency}`,
          ...safe,
        }))
      );
    }
  }

  return summary;
}
