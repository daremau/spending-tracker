"use server";

import Decimal from "decimal.js";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { aggregateMoney, convertAmount } from "@/lib/money/conversion";
import {
  addDecimalValues,
  calculateCashAdjustment,
  calculateMarketValue,
  calculateTransactionCashEffect,
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
  PortfolioTransferActivityDto,
} from "@/lib/portfolio/dtos";
import {
  investmentActivitySchema,
  investmentAccountSchema,
  manualAssetSchema,
  manualQuoteSchema,
  openingPositionSchema,
  portfolioTransferSchema,
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

async function withSerializableRetry<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>
) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(callback, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      const retryable =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (!retryable || attempt === maxAttempts) throw error;
    }
  }
  throw new Error("Could not complete serializable transaction");
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

function serializeFundingActivity(
  transaction: {
    id: string;
    amount: Prisma.Decimal;
    description: string | null;
    date: Date;
    accountId: string;
    account: { name: string; currency: string };
    toAccount: { name: string; currency: string } | null;
  },
  cashAccountId: string
): PortfolioTransferActivityDto {
  const funding = transaction.toAccount !== null &&
    transaction.accountId !== cashAccountId;
  const bankAccount = funding ? transaction.account : transaction.toAccount;
  if (!bankAccount) {
    throw new Error("Portfolio transfer is missing its bank account");
  }

  return {
    id: transaction.id,
    type: funding ? "FUNDING" : "WITHDRAWAL",
    amount: transaction.amount.toString(),
    currency: bankAccount.currency,
    bankAccountName: bankAccount.name,
    date: transaction.date.toISOString(),
    notes: transaction.description,
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
  let realizedGainNative = new Decimal(0);
  let realizedGainReporting = new Decimal(0);
  let dividendsNative = new Decimal(0);
  let dividendsReporting = new Decimal(0);
  let feesNative = new Decimal(0);
  let feesReporting = new Decimal(0);
  for (const transactions of grouped.values()) {
    const asset = transactions[0]?.asset;
    if (!asset) continue;
    const state = replayLedger(transactions.map(toLedgerInput));
    realizedGainNative = realizedGainNative.plus(state.realizedGainNative);
    realizedGainReporting = realizedGainReporting.plus(
      state.realizedGainReporting
    );
    dividendsNative = dividendsNative.plus(state.dividendsNative);
    dividendsReporting = dividendsReporting.plus(state.dividendsReporting);
    feesNative = feesNative.plus(state.feesNative);
    feesReporting = feesReporting.plus(state.feesReporting);
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

  const accountLevelActivity = account.transactions.filter(
    (transaction) => !transaction.assetId
  );
  if (accountLevelActivity.length > 0) {
    const state = replayLedger(accountLevelActivity.map(toLedgerInput));
    realizedGainNative = realizedGainNative.plus(state.realizedGainNative);
    realizedGainReporting = realizedGainReporting.plus(
      state.realizedGainReporting
    );
    dividendsNative = dividendsNative.plus(state.dividendsNative);
    dividendsReporting = dividendsReporting.plus(state.dividendsReporting);
    feesNative = feesNative.plus(state.feesNative);
    feesReporting = feesReporting.plus(state.feesReporting);
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
    realizedGainNative: realizedGainNative.toString(),
    realizedGainReporting: realizedGainReporting.toString(),
    dividendsNative: dividendsNative.toString(),
    dividendsReporting: dividendsReporting.toString(),
    feesNative: feesNative.toString(),
    feesReporting: feesReporting.toString(),
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

  const [standardAccounts, fundingTransactions] = await Promise.all([
    prisma.bankAccount.findMany({
      where: {
        kind: "STANDARD",
        currency: account.cashCurrency,
      },
      select: { id: true, name: true, currency: true, balance: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.transaction.findMany({
      where: {
        type: "TRANSFER",
        clientRequestId: { not: null },
        OR: [
          { accountId: loadedAccount.cashAccountId },
          { toAccountId: loadedAccount.cashAccountId },
        ],
      },
      include: {
        account: { select: { name: true, currency: true } },
        toAccount: { select: { name: true, currency: true } },
      },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return {
    account,
    activities: [...loadedAccount.transactions]
      .sort((left, right) => right.date.getTime() - left.date.getTime())
      .map(serializeActivity),
    fundingActivities: fundingTransactions.map((transaction) =>
      serializeFundingActivity(transaction, loadedAccount.cashAccountId)
    ),
    assets: state.assets.map(serializeAsset),
    standardAccounts: standardAccounts.map((standardAccount) => ({
      ...standardAccount,
      balance: standardAccount.balance.toString(),
    })),
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

type InvestmentActivityFormValues = {
  clientRequestId: string;
  accountId: string;
  assetId: string;
  type: "BUY" | "SELL" | "DIVIDEND" | "FEE";
  quantity: string;
  unitPrice: string;
  cashAmount: string;
  fees: string;
  fxRateToReporting: string;
  date: Date;
  notes: string;
};

type NormalizedInvestmentActivity = {
  clientRequestId: string;
  accountId: string;
  assetId: string | null;
  type: "BUY" | "SELL" | "DIVIDEND" | "FEE";
  quantity: string | null;
  unitPrice: string | null;
  cashAmount: string;
  fees: string;
  currency: string;
  fxRateToReporting: string;
  date: Date;
  notes: string | null;
};

async function normalizeInvestmentActivity(
  tx: Prisma.TransactionClient,
  values: InvestmentActivityFormValues
): Promise<{
  activity: NormalizedInvestmentActivity;
  cashAccountId: string;
}> {
  const [account, asset, settings] = await Promise.all([
    tx.investmentAccount.findUnique({
      where: { id: values.accountId },
      include: { cashAccount: true },
    }),
    values.assetId
      ? tx.asset.findUnique({ where: { id: values.assetId } })
      : null,
    tx.appSettings.findUnique({ where: { id: SETTINGS_ID } }),
  ]);

  if (!account || account.archivedAt) {
    throw new Error("Active investment account not found");
  }
  if (account.cashAccount.kind !== "INVESTMENT_CASH") {
    throw new Error("Linked investment cash account is invalid");
  }
  if (values.type !== "FEE" && (!asset || !asset.active)) {
    throw new Error("Active asset not found");
  }
  if (values.assetId && (!asset || !asset.active)) {
    throw new Error("Active asset not found");
  }

  const currency = asset?.quoteCurrency ?? account.cashCurrency;
  if (currency !== account.cashCurrency) {
    throw new Error(
      `This account uses ${account.cashCurrency}; choose an asset quoted in that currency`
    );
  }

  const trade = values.type === "BUY" || values.type === "SELL";
  const quantity = trade ? values.quantity : null;
  const unitPrice = trade ? values.unitPrice : null;
  const cashAmount = trade
    ? new Decimal(values.quantity).times(values.unitPrice).toString()
    : values.cashAmount;
  const fees = values.type === "FEE" ? "0" : values.fees || "0";
  const reportingCurrency = settings?.reportingCurrency ?? "PYG";
  const fxRate =
    currency === reportingCurrency ? "1" : values.fxRateToReporting;

  const activity: NormalizedInvestmentActivity = {
    clientRequestId: values.clientRequestId,
    accountId: values.accountId,
    assetId: asset?.id ?? null,
    type: values.type,
    quantity,
    unitPrice,
    cashAmount,
    fees,
    currency,
    fxRateToReporting: fxRate,
    date: values.date,
    notes: values.notes || null,
  };

  const cashEffect = new Decimal(calculateTransactionCashEffect({
    id: activity.clientRequestId,
    type: activity.type,
    quantity: activity.quantity,
    unitPrice: activity.unitPrice,
    cashAmount: activity.cashAmount,
    fees: activity.fees,
  }));
  if (
    (activity.type === "SELL" || activity.type === "DIVIDEND") &&
    !cashEffect.isPositive()
  ) {
    throw new Error("Fees must be less than the gross cash amount");
  }

  return { activity, cashAccountId: account.cashAccountId };
}

function investmentActivityMatches(
  existing: {
    clientRequestId: string;
    accountId: string;
    assetId: string | null;
    type: "OPENING_POSITION" | "BUY" | "SELL" | "DIVIDEND" | "FEE";
    quantity: Prisma.Decimal | null;
    unitPrice: Prisma.Decimal | null;
    cashAmount: Prisma.Decimal | null;
    fees: Prisma.Decimal;
    currency: string;
    fxRateToReporting: Prisma.Decimal;
    date: Date;
    notes: string | null;
  },
  proposed: NormalizedInvestmentActivity
) {
  return (
    existing.clientRequestId === proposed.clientRequestId &&
    existing.accountId === proposed.accountId &&
    existing.assetId === proposed.assetId &&
    existing.type === proposed.type &&
    (existing.quantity?.equals(proposed.quantity ?? 0) ??
      proposed.quantity === null) &&
    (existing.unitPrice?.equals(proposed.unitPrice ?? 0) ??
      proposed.unitPrice === null) &&
    existing.cashAmount?.equals(proposed.cashAmount) === true &&
    existing.fees.equals(proposed.fees) &&
    existing.currency === proposed.currency &&
    existing.fxRateToReporting.equals(proposed.fxRateToReporting) &&
    existing.date.getTime() === proposed.date.getTime() &&
    existing.notes === proposed.notes
  );
}

function normalizedToLedgerInput(
  activity: NormalizedInvestmentActivity,
  id: string,
  createdAt: Date
): LedgerTransactionInput {
  return {
    id,
    type: activity.type,
    quantity: activity.quantity,
    unitPrice: activity.unitPrice,
    cashAmount: activity.cashAmount,
    fees: activity.fees,
    fxRateToReporting: activity.fxRateToReporting,
    date: activity.date,
    createdAt,
  };
}

async function validateProposedAssetLedger(
  tx: Prisma.TransactionClient,
  proposed: NormalizedInvestmentActivity | null,
  original: {
    id: string;
    accountId: string;
    assetId: string | null;
    createdAt: Date;
  } | null
) {
  const accountId = proposed?.accountId ?? original?.accountId;
  const assetId = proposed?.assetId ?? original?.assetId;
  if (!accountId || !assetId) return;

  const ledger = await tx.investmentTransaction.findMany({
    where: {
      accountId,
      assetId,
      ...(original ? { id: { not: original.id } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }, { id: "asc" }],
  });
  replayLedger([
    ...ledger.map(toLedgerInput),
    ...(proposed
      ? [
          normalizedToLedgerInput(
            proposed,
            original?.id ?? proposed.clientRequestId,
            original?.createdAt ?? new Date()
          ),
        ]
      : []),
  ]);
}

async function applyInvestmentCashAdjustment(
  tx: Prisma.TransactionClient,
  cashAccountId: string,
  adjustmentValue: string
) {
  const adjustment = new Decimal(adjustmentValue);
  if (adjustment.isZero()) return;

  if (adjustment.isNegative()) {
    const debit = adjustment.abs().toString();
    const result = await tx.bankAccount.updateMany({
      where: {
        id: cashAccountId,
        kind: "INVESTMENT_CASH",
        balance: { gte: debit },
      },
      data: { balance: { decrement: debit } },
    });
    if (result.count !== 1) {
      throw new Error("Insufficient investment cash for this activity");
    }
    return;
  }

  const result = await tx.bankAccount.updateMany({
    where: { id: cashAccountId, kind: "INVESTMENT_CASH" },
    data: { balance: { increment: adjustment.toString() } },
  });
  if (result.count !== 1) {
    throw new Error("Linked investment cash account not found");
  }
}

function parseInvestmentActivity(formData: FormData) {
  return investmentActivitySchema.safeParse({
    clientRequestId: formData.get("clientRequestId"),
    accountId: formData.get("accountId"),
    assetId: formData.get("assetId") || "",
    type: formData.get("type"),
    quantity: formData.get("quantity") || "",
    unitPrice: formData.get("unitPrice") || "",
    cashAmount: formData.get("cashAmount") || "",
    fees: formData.get("fees") || "0",
    fxRateToReporting: formData.get("fxRateToReporting"),
    date: formData.get("date"),
    notes: formData.get("notes") || "",
  });
}

export async function createInvestmentActivity(formData: FormData) {
  const parsed = parseInvestmentActivity(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid activity" };
  }

  try {
    const result = await withSerializableRetry(
      async (tx) => {
        const normalized = await normalizeInvestmentActivity(tx, parsed.data);
        const existing = await tx.investmentTransaction.findUnique({
          where: { clientRequestId: normalized.activity.clientRequestId },
        });
        if (existing) {
          if (!investmentActivityMatches(existing, normalized.activity)) {
            throw new Error(
              "This request identifier was already used for different data"
            );
          }
          return existing;
        }

        await validateProposedAssetLedger(tx, normalized.activity, null);
        const adjustment = calculateCashAdjustment(null, {
          id: normalized.activity.clientRequestId,
          ...normalized.activity,
        });
        await applyInvestmentCashAdjustment(
          tx,
          normalized.cashAccountId,
          adjustment
        );

        return tx.investmentTransaction.create({
          data: normalized.activity,
        });
      }
    );
    revalidatePortfolio(result.accountId);
    return { success: true as const, id: result.id };
  } catch (error) {
    return { error: actionError(error, "Could not create investment activity") };
  }
}

export async function updateInvestmentActivity(id: string, formData: FormData) {
  const parsed = parseInvestmentActivity(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid activity" };
  }

  try {
    const result = await withSerializableRetry(
      async (tx) => {
        const original = await tx.investmentTransaction.findUnique({
          where: { id },
          include: { account: true },
        });
        if (!original || original.type === "OPENING_POSITION") {
          throw new Error("Investment activity not found");
        }
        if (original.account.archivedAt) {
          throw new Error("Archived accounts are read-only");
        }
        if (
          parsed.data.clientRequestId !== original.clientRequestId ||
          parsed.data.accountId !== original.accountId ||
          parsed.data.type !== original.type ||
          (parsed.data.assetId || null) !== original.assetId
        ) {
          throw new Error(
            "Account, asset, type, and request identifier cannot be changed while editing"
          );
        }

        const normalized = await normalizeInvestmentActivity(tx, parsed.data);
        await validateProposedAssetLedger(tx, normalized.activity, original);
        const adjustment = calculateCashAdjustment(
          {
            id: original.id,
            type: original.type,
            quantity: original.quantity?.toString() ?? null,
            unitPrice: original.unitPrice?.toString() ?? null,
            cashAmount: original.cashAmount?.toString() ?? null,
            fees: original.fees.toString(),
          },
          {
            id: original.id,
            type: normalized.activity.type,
            quantity: normalized.activity.quantity,
            unitPrice: normalized.activity.unitPrice,
            cashAmount: normalized.activity.cashAmount,
            fees: normalized.activity.fees,
          }
        );
        await applyInvestmentCashAdjustment(
          tx,
          normalized.cashAccountId,
          adjustment
        );

        return tx.investmentTransaction.update({
          where: { id },
          data: {
            quantity: normalized.activity.quantity,
            unitPrice: normalized.activity.unitPrice,
            cashAmount: normalized.activity.cashAmount,
            fees: normalized.activity.fees,
            currency: normalized.activity.currency,
            fxRateToReporting: normalized.activity.fxRateToReporting,
            date: normalized.activity.date,
            notes: normalized.activity.notes,
          },
        });
      }
    );
    revalidatePortfolio(result.accountId);
    return { success: true as const };
  } catch (error) {
    return { error: actionError(error, "Could not update investment activity") };
  }
}

export async function deleteInvestmentActivity(id: string) {
  try {
    const result = await withSerializableRetry(
      async (tx) => {
        const original = await tx.investmentTransaction.findUnique({
          where: { id },
          include: { account: true },
        });
        if (!original || original.type === "OPENING_POSITION") {
          throw new Error("Investment activity not found");
        }
        if (original.account.archivedAt) {
          throw new Error("Archived accounts are read-only");
        }

        await validateProposedAssetLedger(tx, null, original);
        const adjustment = calculateCashAdjustment(
          {
            id: original.id,
            type: original.type,
            quantity: original.quantity?.toString() ?? null,
            unitPrice: original.unitPrice?.toString() ?? null,
            cashAmount: original.cashAmount?.toString() ?? null,
            fees: original.fees.toString(),
          },
          null
        );
        await applyInvestmentCashAdjustment(
          tx,
          original.account.cashAccountId,
          adjustment
        );
        await tx.investmentTransaction.delete({ where: { id } });
        return original;
      }
    );
    revalidatePortfolio(result.accountId);
    return { success: true as const };
  } catch (error) {
    return { error: actionError(error, "Could not delete investment activity") };
  }
}

export async function createPortfolioTransfer(formData: FormData) {
  const parsed = portfolioTransferSchema.safeParse({
    clientRequestId: formData.get("clientRequestId"),
    accountId: formData.get("accountId"),
    bankAccountId: formData.get("bankAccountId"),
    direction: formData.get("direction"),
    amount: formData.get("amount"),
    date: formData.get("date"),
    notes: formData.get("notes") || "",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid transfer" };
  }

  try {
    const result = await withSerializableRetry(
      async (tx) => {
        const [investmentAccount, bankAccount] = await Promise.all([
          tx.investmentAccount.findUnique({
            where: { id: parsed.data.accountId },
            include: { cashAccount: true },
          }),
          tx.bankAccount.findFirst({
            where: { id: parsed.data.bankAccountId, kind: "STANDARD" },
          }),
        ]);
        if (!investmentAccount || investmentAccount.archivedAt) {
          throw new Error("Active investment account not found");
        }
        if (!bankAccount) throw new Error("Standard bank account not found");
        if (
          investmentAccount.cashAccount.kind !== "INVESTMENT_CASH" ||
          investmentAccount.cashAccount.currency !== bankAccount.currency
        ) {
          throw new Error(
            `Choose a standard ${investmentAccount.cashCurrency} account`
          );
        }

        const funding = parsed.data.direction === "FUND";
        const sourceId = funding
          ? bankAccount.id
          : investmentAccount.cashAccountId;
        const destinationId = funding
          ? investmentAccount.cashAccountId
          : bankAccount.id;
        const description =
          parsed.data.notes ||
          (funding
            ? `Fund ${investmentAccount.name}`
            : `Withdraw from ${investmentAccount.name}`);

        const existing = await tx.transaction.findUnique({
          where: { clientRequestId: parsed.data.clientRequestId },
        });
        if (existing) {
          if (
            existing.type !== "TRANSFER" ||
            existing.accountId !== sourceId ||
            existing.toAccountId !== destinationId ||
            !existing.amount.equals(parsed.data.amount) ||
            existing.date.getTime() !== parsed.data.date.getTime() ||
            existing.description !== description
          ) {
            throw new Error(
              "This request identifier was already used for different data"
            );
          }
          return existing;
        }

        const debit = await tx.bankAccount.updateMany({
          where: {
            id: sourceId,
            balance: { gte: parsed.data.amount },
          },
          data: { balance: { decrement: parsed.data.amount } },
        });
        if (debit.count !== 1) {
          throw new Error(
            funding
              ? "Insufficient bank balance for this funding transfer"
              : "Insufficient investment cash for this withdrawal"
          );
        }
        await tx.bankAccount.update({
          where: { id: destinationId },
          data: { balance: { increment: parsed.data.amount } },
        });

        return tx.transaction.create({
          data: {
            clientRequestId: parsed.data.clientRequestId,
            type: "TRANSFER",
            amount: parsed.data.amount,
            description,
            date: parsed.data.date,
            accountId: sourceId,
            toAccountId: destinationId,
          },
        });
      }
    );
    revalidatePortfolio(parsed.data.accountId);
    return { success: true as const, id: result.id };
  } catch (error) {
    return { error: actionError(error, "Could not transfer investment cash") };
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
