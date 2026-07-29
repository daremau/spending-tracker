"use server";

import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { aggregateMoney, convertAmount } from "@/lib/money/conversion";
import {
  addDecimalValues,
  calculateMarketValue,
  replayLedger,
  type LedgerTransactionInput,
} from "@/lib/portfolio/calculations";
import type {
  InvestmentAccountDetailDto,
  InvestmentActivityDto,
  PortfolioAccountSummaryDto,
  PortfolioAssetDto,
  PortfolioOverviewDto,
  PortfolioPositionDto,
} from "@/lib/portfolio/dtos";
import {
  investmentAccountSchema,
  manualAssetSchema,
  manualQuoteSchema,
  openingPositionSchema,
} from "@/lib/portfolio/validation";

const SETTINGS_ID = "singleton";

function actionError(error: unknown, fallback: string) {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return "That record already exists.";
  }
  return error instanceof Error ? error.message : fallback;
}

function revalidatePortfolio(accountId?: string) {
  revalidatePath("/portfolio");
  if (accountId) {
    revalidatePath(`/portfolio/accounts/${accountId}`);
  }
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/transactions");
}

function toLedgerInput(transaction: {
  id: string;
  type: "OPENING_POSITION" | "BUY" | "SELL" | "DIVIDEND" | "FEE";
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  cashAmount: Prisma.Decimal | null;
  fees: Prisma.Decimal;
  fxRateToReporting: Prisma.Decimal;
  date: Date;
  createdAt: Date;
}): LedgerTransactionInput {
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

function serializeAsset(asset: {
  id: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  symbol: string;
  name: string;
  market: string;
  quoteCurrency: string;
}): PortfolioAssetDto {
  return {
    id: asset.id,
    type: asset.type,
    symbol: asset.symbol,
    name: asset.name,
    market: asset.market,
    quoteCurrency: asset.quoteCurrency,
  };
}

function serializeActivity(transaction: {
  id: string;
  clientRequestId: string;
  type: "OPENING_POSITION" | "BUY" | "SELL" | "DIVIDEND" | "FEE";
  assetId: string | null;
  asset: { symbol: string } | null;
  quantity: Prisma.Decimal | null;
  unitPrice: Prisma.Decimal | null;
  cashAmount: Prisma.Decimal | null;
  fees: Prisma.Decimal;
  currency: string;
  fxRateToReporting: Prisma.Decimal;
  date: Date;
  notes: string | null;
}): InvestmentActivityDto {
  return {
    id: transaction.id,
    clientRequestId: transaction.clientRequestId,
    type: transaction.type,
    assetId: transaction.assetId,
    assetSymbol: transaction.asset?.symbol ?? null,
    quantity: transaction.quantity?.toString() ?? null,
    unitPrice: transaction.unitPrice?.toString() ?? null,
    cashAmount: transaction.cashAmount?.toString() ?? null,
    fees: transaction.fees.toString(),
    currency: transaction.currency,
    fxRateToReporting: transaction.fxRateToReporting.toString(),
    date: transaction.date.toISOString(),
    notes: transaction.notes,
  };
}

type LoadedInvestmentAccount = Prisma.InvestmentAccountGetPayload<{
  include: {
    cashAccount: true;
    transactions: {
      include: { asset: { include: { marketQuotes: true } } };
    };
  };
}>;

function buildAccountSummary(
  account: LoadedInvestmentAccount,
  reportingCurrency: string,
  rates: Array<{
    fromCurrency: string;
    toCurrency: string;
    rate: Prisma.Decimal;
    active: boolean;
    source: "MANUAL" | "TWELVE_DATA";
  }>
): PortfolioAccountSummaryDto {
  const grouped = new Map<
    string,
    LoadedInvestmentAccount["transactions"]
  >();

  for (const transaction of account.transactions) {
    if (!transaction.assetId || !transaction.asset) continue;
    const current = grouped.get(transaction.assetId) ?? [];
    current.push(transaction);
    grouped.set(transaction.assetId, current);
  }

  const positions: PortfolioPositionDto[] = [];
  for (const transactions of grouped.values()) {
    const asset = transactions[0]?.asset;
    if (!asset) continue;
    const state = replayLedger(transactions.map(toLedgerInput));
    if (new Decimal(state.quantity).isZero()) continue;

    const manualQuote = asset.marketQuotes.find(
      (quote) => quote.source === "MANUAL" && quote.active
    );
    const providerQuote = asset.marketQuotes.find(
      (quote) => quote.source === "TWELVE_DATA" && quote.active
    );
    const fallbackTransaction = [...transactions]
      .filter((transaction) => transaction.unitPrice)
      .sort((left, right) => {
        const dateDifference = right.date.getTime() - left.date.getTime();
        if (dateDifference !== 0) return dateDifference;
        return right.createdAt.getTime() - left.createdAt.getTime();
      })[0];

    const effectiveQuote = manualQuote ?? providerQuote;
    const quotePrice =
      effectiveQuote?.price.toString() ??
      fallbackTransaction?.unitPrice?.toString() ??
      null;
    const quoteSource = manualQuote
      ? "MANUAL"
      : providerQuote
        ? "FALLBACK"
        : fallbackTransaction
          ? "FALLBACK"
          : "UNAVAILABLE";
    const marketValueNative = quotePrice
      ? calculateMarketValue(state.quantity, quotePrice)
      : null;
    const convertedValue = marketValueNative
      ? convertAmount(
          { amount: marketValueNative, currency: asset.quoteCurrency },
          reportingCurrency,
          rates.map((rate) => ({ ...rate, rate: rate.rate.toString() }))
        )
      : null;
    const marketValueReporting =
      convertedValue?.complete === true ? convertedValue.value : null;

    positions.push({
      accountId: account.id,
      asset: serializeAsset(asset),
      quantity: state.quantity,
      averageCostNative: state.averageCostNative,
      remainingCostNative: state.remainingCostNative,
      remainingCostReporting: state.remainingCostReporting,
      quote: {
        price: quotePrice,
        source: quoteSource,
        asOf:
          effectiveQuote?.asOf.toISOString() ??
          fallbackTransaction?.date.toISOString() ??
          null,
        manualQuoteId: manualQuote?.id ?? null,
      },
      marketValueNative,
      marketValueReporting,
      unrealizedGainNative: marketValueNative
        ? new Decimal(marketValueNative)
            .minus(state.remainingCostNative)
            .toString()
        : null,
      unrealizedGainReporting: marketValueReporting
        ? new Decimal(marketValueReporting)
            .minus(state.remainingCostReporting)
            .toString()
        : null,
      reportingComplete:
        marketValueNative !== null && convertedValue?.complete === true,
      missingRates:
        convertedValue && !convertedValue.complete
          ? convertedValue.missingRates
          : [],
    });
  }

  const missingQuotes = positions
    .filter((position) => !position.marketValueNative)
    .map((position) => position.asset.symbol);
  const missingRates = Array.from(
    new Set(positions.flatMap((position) => position.missingRates))
  ).sort();
  const holdingsValueNative =
    missingQuotes.length === 0
      ? addDecimalValues(
          positions.map((position) => position.marketValueNative ?? "0")
        )
      : null;
  const totalValueNative =
    holdingsValueNative === null
      ? null
      : addDecimalValues([
          account.cashAccount.balance.toString(),
          holdingsValueNative,
        ]);
  const totalConversion =
    totalValueNative === null
      ? null
      : convertAmount(
          { amount: totalValueNative, currency: account.cashCurrency },
          reportingCurrency,
          rates.map((rate) => ({ ...rate, rate: rate.rate.toString() }))
        );

  return {
    id: account.id,
    name: account.name,
    type: account.type,
    cashCurrency: account.cashCurrency,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    cashBalance: account.cashAccount.balance.toString(),
    positionCount: positions.length,
    holdingsValueNative,
    totalValueNative,
    totalValueReporting:
      totalConversion?.complete === true ? totalConversion.value : null,
    reportingCurrency,
    complete:
      missingQuotes.length === 0 &&
      missingRates.length === 0 &&
      totalConversion?.complete === true,
    missingRates: Array.from(
      new Set([
        ...missingRates,
        ...(totalConversion && !totalConversion.complete
          ? totalConversion.missingRates
          : []),
      ])
    ).sort(),
    missingQuotes,
    positions,
  };
}

async function loadPortfolioState() {
  const settings = await prisma.appSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      reportingCurrency: "PYG",
      timezone: "America/Asuncion",
    },
  });

  const [accounts, assets, rates] = await Promise.all([
    prisma.investmentAccount.findMany({
      include: {
        cashAccount: true,
        transactions: {
          include: { asset: { include: { marketQuotes: true } } },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
        },
      },
      orderBy: [{ archivedAt: "asc" }, { createdAt: "asc" }],
    }),
    prisma.asset.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { symbol: "asc" }],
    }),
    prisma.exchangeRate.findMany({
      where: { active: true, toCurrency: settings.reportingCurrency },
    }),
  ]);

  return {
    settings,
    accounts,
    assets,
    rates,
    summaries: accounts.map((account) =>
      buildAccountSummary(account, settings.reportingCurrency, rates)
    ),
  };
}

export async function getPortfolioOverview(): Promise<PortfolioOverviewDto> {
  const state = await loadPortfolioState();
  const activeAccounts = state.summaries.filter(
    (account) => !account.archivedAt
  );
  const missingQuotes = Array.from(
    new Set(activeAccounts.flatMap((account) => account.missingQuotes))
  ).sort();
  const missingRates = Array.from(
    new Set(activeAccounts.flatMap((account) => account.missingRates))
  ).sort();

  const cashConversion = aggregateMoney(
    state.accounts
      .filter((account) => !account.archivedAt)
      .map((account) => ({
        amount: account.cashAccount.balance.toString(),
        currency: account.cashCurrency,
      })),
    state.settings.reportingCurrency,
    state.rates.map((rate) => ({ ...rate, rate: rate.rate.toString() }))
  );
  const holdingsConversion =
    missingQuotes.length > 0
      ? null
      : aggregateMoney(
          activeAccounts.flatMap((account) =>
            account.positions.map((position) => ({
              amount: position.marketValueNative ?? "0",
              currency: position.asset.quoteCurrency,
            }))
          ),
          state.settings.reportingCurrency,
          state.rates.map((rate) => ({ ...rate, rate: rate.rate.toString() }))
        );

  const complete =
    missingQuotes.length === 0 &&
    missingRates.length === 0 &&
    cashConversion.complete &&
    holdingsConversion?.complete === true;
  const totalValueReporting = complete
    ? addDecimalValues([
        cashConversion.value,
        holdingsConversion.value,
      ])
    : null;

  return {
    reportingCurrency: state.settings.reportingCurrency,
    totalValueReporting,
    cashValueReporting: cashConversion.complete ? cashConversion.value : null,
    holdingsValueReporting:
      holdingsConversion?.complete === true ? holdingsConversion.value : null,
    costBasisReporting: addDecimalValues(
      activeAccounts.flatMap((account) =>
        account.positions.map((position) => position.remainingCostReporting)
      )
    ),
    complete,
    missingRates: Array.from(
      new Set([
        ...missingRates,
        ...(!cashConversion.complete ? cashConversion.missingRates : []),
        ...(holdingsConversion && !holdingsConversion.complete
          ? holdingsConversion.missingRates
          : []),
      ])
    ).sort(),
    missingQuotes,
    accounts: state.summaries,
    assets: state.assets.map(serializeAsset),
  };
}

export async function getInvestmentAccountDetail(
  id: string
): Promise<InvestmentAccountDetailDto | null> {
  const state = await loadPortfolioState();
  const account = state.summaries.find((summary) => summary.id === id);
  const loadedAccount = state.accounts.find((candidate) => candidate.id === id);
  if (!account || !loadedAccount) return null;

  return {
    account,
    activities: [...loadedAccount.transactions]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .map(serializeActivity),
    assets: state.assets.map(serializeAsset),
  };
}

export async function createInvestmentAccount(formData: FormData) {
  const parsed = investmentAccountSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type"),
    cashCurrency: formData.get("cashCurrency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid account" };
  }

  try {
    const account = await prisma.$transaction(async (tx) => {
      const cashAccount = await tx.bankAccount.create({
        data: {
          name: `${parsed.data.name} Cash`,
          balance: 0,
          currency: parsed.data.cashCurrency,
          kind: "INVESTMENT_CASH",
        },
      });
      return tx.investmentAccount.create({
        data: {
          name: parsed.data.name,
          type: parsed.data.type,
          cashCurrency: parsed.data.cashCurrency,
          cashAccountId: cashAccount.id,
        },
      });
    });
    revalidatePortfolio(account.id);
    return { success: true as const, id: account.id };
  } catch (error) {
    return { error: actionError(error, "Could not create investment account") };
  }
}

export async function renameInvestmentAccount(id: string, formData: FormData) {
  const name = formData.get("name");
  const parsed = investmentAccountSchema.pick({ name: true }).safeParse({ name });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid account name" };
  }

  const account = await prisma.investmentAccount.findUnique({
    where: { id },
    select: { cashAccountId: true, archivedAt: true },
  });
  if (!account) return { error: "Investment account not found" };
  if (account.archivedAt) return { error: "Archived accounts are read-only" };

  await prisma.$transaction([
    prisma.investmentAccount.update({
      where: { id },
      data: { name: parsed.data.name },
    }),
    prisma.bankAccount.update({
      where: { id: account.cashAccountId },
      data: { name: `${parsed.data.name} Cash` },
    }),
  ]);
  revalidatePortfolio(id);
  return { success: true as const };
}

export async function archiveInvestmentAccount(id: string) {
  const result = await prisma.investmentAccount.updateMany({
    where: { id, archivedAt: null },
    data: { archivedAt: new Date() },
  });
  if (result.count === 0) return { error: "Active investment account not found" };
  revalidatePortfolio(id);
  return { success: true as const };
}

export async function createManualAsset(formData: FormData) {
  const parsed = manualAssetSchema.safeParse({
    type: formData.get("type"),
    symbol: formData.get("symbol"),
    name: formData.get("name"),
    market: formData.get("market"),
    quoteCurrency: formData.get("quoteCurrency"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid asset" };
  }

  try {
    const asset = await prisma.asset.create({ data: parsed.data });
    revalidatePortfolio();
    return { success: true as const, id: asset.id };
  } catch (error) {
    return { error: actionError(error, "Could not create asset") };
  }
}

function openingMatches(
  existing: {
    accountId: string;
    assetId: string | null;
    quantity: Prisma.Decimal | null;
    unitPrice: Prisma.Decimal | null;
    fees: Prisma.Decimal;
    fxRateToReporting: Prisma.Decimal;
    date: Date;
    notes: string | null;
  },
  proposed: {
    accountId: string;
    assetId: string;
    quantity: string;
    unitPrice: string;
    fees: string;
    fxRateToReporting: string;
    date: Date;
    notes: string;
  }
) {
  return (
    existing.accountId === proposed.accountId &&
    existing.assetId === proposed.assetId &&
    existing.quantity?.equals(proposed.quantity) === true &&
    existing.unitPrice?.equals(proposed.unitPrice) === true &&
    existing.fees.equals(proposed.fees) &&
    existing.fxRateToReporting.equals(proposed.fxRateToReporting) &&
    existing.date.getTime() === proposed.date.getTime() &&
    (existing.notes ?? "") === proposed.notes
  );
}

async function validateOpeningReferences(
  tx: Prisma.TransactionClient,
  accountId: string,
  assetId: string
) {
  const [account, asset, settings] = await Promise.all([
    tx.investmentAccount.findUnique({ where: { id: accountId } }),
    tx.asset.findUnique({ where: { id: assetId } }),
    tx.appSettings.findUnique({ where: { id: SETTINGS_ID } }),
  ]);
  if (!account || account.archivedAt) {
    throw new Error("Active investment account not found");
  }
  if (!asset || !asset.active) throw new Error("Active asset not found");
  if (asset.quoteCurrency !== account.cashCurrency) {
    throw new Error(
      `This account uses ${account.cashCurrency}; choose an asset quoted in that currency`
    );
  }
  return { account, asset, reportingCurrency: settings?.reportingCurrency ?? "PYG" };
}

export async function createOpeningPosition(formData: FormData) {
  const parsed = openingPositionSchema.safeParse({
    clientRequestId: formData.get("clientRequestId"),
    accountId: formData.get("accountId"),
    assetId: formData.get("assetId"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    fees: formData.get("fees") || "0",
    fxRateToReporting: formData.get("fxRateToReporting"),
    date: formData.get("date"),
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid opening position" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.investmentTransaction.findUnique({
        where: { clientRequestId: parsed.data.clientRequestId },
      });
      if (existing) {
        if (!openingMatches(existing, parsed.data)) {
          throw new Error("This request identifier was already used for different data");
        }
        return existing;
      }

      const { asset, reportingCurrency } = await validateOpeningReferences(
        tx,
        parsed.data.accountId,
        parsed.data.assetId
      );
      const fxRate =
        asset.quoteCurrency === reportingCurrency
          ? "1"
          : parsed.data.fxRateToReporting;
      const cashAmount = new Decimal(parsed.data.quantity)
        .times(parsed.data.unitPrice)
        .toString();
      const existingLedger = await tx.investmentTransaction.findMany({
        where: {
          accountId: parsed.data.accountId,
          assetId: parsed.data.assetId,
        },
        orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
      });
      replayLedger([
        ...existingLedger.map(toLedgerInput),
        {
          id: parsed.data.clientRequestId,
          type: "OPENING_POSITION",
          quantity: parsed.data.quantity,
          unitPrice: parsed.data.unitPrice,
          cashAmount,
          fees: parsed.data.fees,
          fxRateToReporting: fxRate,
          date: parsed.data.date,
          createdAt: new Date(),
        },
      ]);

      return tx.investmentTransaction.create({
        data: {
          clientRequestId: parsed.data.clientRequestId,
          accountId: parsed.data.accountId,
          assetId: parsed.data.assetId,
          type: "OPENING_POSITION",
          quantity: parsed.data.quantity,
          unitPrice: parsed.data.unitPrice,
          cashAmount,
          fees: parsed.data.fees,
          currency: asset.quoteCurrency,
          fxRateToReporting: fxRate,
          date: parsed.data.date,
          notes: parsed.data.notes || null,
        },
      });
    });
    revalidatePortfolio(result.accountId);
    return { success: true as const, id: result.id };
  } catch (error) {
    return { error: actionError(error, "Could not create opening position") };
  }
}

export async function updateOpeningPosition(id: string, formData: FormData) {
  const parsed = openingPositionSchema.safeParse({
    clientRequestId: formData.get("clientRequestId"),
    accountId: formData.get("accountId"),
    assetId: formData.get("assetId"),
    quantity: formData.get("quantity"),
    unitPrice: formData.get("unitPrice"),
    fees: formData.get("fees") || "0",
    fxRateToReporting: formData.get("fxRateToReporting"),
    date: formData.get("date"),
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid opening position" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const original = await tx.investmentTransaction.findUnique({
        where: { id },
      });
      if (!original || original.type !== "OPENING_POSITION") {
        throw new Error("Opening position not found");
      }
      if (
        original.accountId !== parsed.data.accountId ||
        original.assetId !== parsed.data.assetId
      ) {
        throw new Error("Account and asset cannot be changed while editing");
      }

      const { asset, reportingCurrency } = await validateOpeningReferences(
        tx,
        parsed.data.accountId,
        parsed.data.assetId
      );
      const fxRate =
        asset.quoteCurrency === reportingCurrency
          ? "1"
          : parsed.data.fxRateToReporting;
      const cashAmount = new Decimal(parsed.data.quantity)
        .times(parsed.data.unitPrice)
        .toString();
      const ledger = await tx.investmentTransaction.findMany({
        where: {
          accountId: parsed.data.accountId,
          assetId: parsed.data.assetId,
          id: { not: id },
        },
      });
      replayLedger([
        ...ledger.map(toLedgerInput),
        {
          id,
          type: "OPENING_POSITION",
          quantity: parsed.data.quantity,
          unitPrice: parsed.data.unitPrice,
          cashAmount,
          fees: parsed.data.fees,
          fxRateToReporting: fxRate,
          date: parsed.data.date,
          createdAt: original.createdAt,
        },
      ]);

      return tx.investmentTransaction.update({
        where: { id },
        data: {
          quantity: parsed.data.quantity,
          unitPrice: parsed.data.unitPrice,
          cashAmount,
          fees: parsed.data.fees,
          fxRateToReporting: fxRate,
          date: parsed.data.date,
          notes: parsed.data.notes || null,
        },
      });
    });
    revalidatePortfolio(result.accountId);
    return { success: true as const };
  } catch (error) {
    return { error: actionError(error, "Could not update opening position") };
  }
}

export async function deleteOpeningPosition(id: string) {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const original = await tx.investmentTransaction.findUnique({
        where: { id },
        include: { account: true },
      });
      if (!original || original.type !== "OPENING_POSITION" || !original.assetId) {
        throw new Error("Opening position not found");
      }
      if (original.account.archivedAt) {
        throw new Error("Archived accounts are read-only");
      }
      const ledger = await tx.investmentTransaction.findMany({
        where: {
          accountId: original.accountId,
          assetId: original.assetId,
          id: { not: id },
        },
      });
      replayLedger(ledger.map(toLedgerInput));
      await tx.investmentTransaction.delete({ where: { id } });
      return original;
    });
    revalidatePortfolio(result.accountId);
    return { success: true as const };
  } catch (error) {
    return { error: actionError(error, "Could not delete opening position") };
  }
}

export async function upsertManualQuote(formData: FormData) {
  const parsed = manualQuoteSchema.safeParse({
    assetId: formData.get("assetId"),
    price: formData.get("price"),
    asOf: formData.get("asOf"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid quote" };
  }

  const asset = await prisma.asset.findFirst({
    where: { id: parsed.data.assetId, active: true },
  });
  if (!asset) return { error: "Active asset not found" };

  const now = new Date();
  const quote = await prisma.marketQuote.upsert({
    where: {
      assetId_source: { assetId: asset.id, source: "MANUAL" },
    },
    update: {
      price: parsed.data.price,
      currency: asset.quoteCurrency,
      asOf: parsed.data.asOf,
      fetchedAt: now,
      active: true,
    },
    create: {
      assetId: asset.id,
      source: "MANUAL",
      price: parsed.data.price,
      currency: asset.quoteCurrency,
      asOf: parsed.data.asOf,
      fetchedAt: now,
      active: true,
    },
  });
  revalidatePortfolio();
  return { success: true as const, id: quote.id };
}

export async function deactivateManualQuote(id: string) {
  const result = await prisma.marketQuote.updateMany({
    where: { id, source: "MANUAL", active: true },
    data: { active: false },
  });
  if (result.count === 0) return { error: "Active manual quote not found" };
  revalidatePortfolio();
  return { success: true as const };
}
