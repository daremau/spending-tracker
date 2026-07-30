import { prisma } from "@/lib/prisma";
import { BACKUP_VERSION, type BackupDataV2 } from "./types";

/**
 * Reads the complete user-entered dataset into a version 2 backup.
 *
 * Provider-sourced quotes and exchange rates are skipped on purpose: they are a
 * refetchable cache, and carrying stale prices across a restore would present
 * old data as current. No environment variable or credential is read here, so
 * an export can never contain a provider secret.
 */
export async function collectBackup(): Promise<BackupDataV2> {
  const [
    settings,
    accounts,
    categories,
    transactions,
    exchangeRates,
    assets,
    investmentAccounts,
    investmentTransactions,
    manualQuotes,
  ] = await Promise.all([
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    prisma.bankAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      include: { account: true, category: true, toAccount: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.exchangeRate.findMany({
      where: { source: "MANUAL" },
      orderBy: [{ fromCurrency: "asc" }, { toCurrency: "asc" }],
    }),
    prisma.asset.findMany({ orderBy: [{ type: "asc" }, { symbol: "asc" }] }),
    prisma.investmentAccount.findMany({
      include: { cashAccount: true },
      orderBy: { name: "asc" },
    }),
    prisma.investmentTransaction.findMany({
      include: { account: true, asset: true },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    }),
    prisma.marketQuote.findMany({
      where: { source: "MANUAL" },
      include: { asset: true },
    }),
  ]);

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: {
      reportingCurrency: settings?.reportingCurrency ?? "PYG",
      timezone: settings?.timezone ?? "America/Asuncion",
    },
    accounts: accounts.map((account) => ({
      name: account.name,
      balance: account.balance.toString(),
      currency: account.currency,
      kind: account.kind,
    })),
    categories: categories.map((category) => ({
      name: category.name,
      type: category.type,
      color: category.color,
      icon: category.icon,
    })),
    transactions: transactions.map((transaction) => ({
      key: transaction.id,
      type: transaction.type,
      amount: transaction.amount.toString(),
      description: transaction.description,
      date: transaction.date.toISOString(),
      accountName: transaction.account.name,
      categoryName: transaction.category?.name ?? null,
      toAccountName: transaction.toAccount?.name ?? null,
      isDigitalTax: transaction.isDigitalTax,
      parentKey: transaction.parentTransactionId,
    })),
    exchangeRates: exchangeRates.map((rate) => ({
      fromCurrency: rate.fromCurrency,
      toCurrency: rate.toCurrency,
      rate: rate.rate.toString(),
      asOf: rate.asOf.toISOString(),
      active: rate.active,
    })),
    assets: assets.map((asset) => ({
      type: asset.type,
      symbol: asset.symbol,
      name: asset.name,
      market: asset.market,
      quoteCurrency: asset.quoteCurrency,
      provider: asset.provider,
      providerSymbol: asset.providerSymbol,
      active: asset.active,
    })),
    investmentAccounts: investmentAccounts.map((account) => ({
      name: account.name,
      type: account.type,
      cashCurrency: account.cashCurrency,
      cashAccountName: account.cashAccount.name,
      archivedAt: account.archivedAt?.toISOString() ?? null,
    })),
    investmentTransactions: investmentTransactions.map((transaction) => ({
      clientRequestId: transaction.clientRequestId,
      accountName: transaction.account.name,
      assetType: transaction.asset?.type ?? null,
      assetSymbol: transaction.asset?.symbol ?? null,
      assetMarket: transaction.asset?.market ?? null,
      type: transaction.type,
      quantity: transaction.quantity?.toString() ?? null,
      unitPrice: transaction.unitPrice?.toString() ?? null,
      cashAmount: transaction.cashAmount?.toString() ?? null,
      fees: transaction.fees.toString(),
      currency: transaction.currency,
      fxRateToReporting: transaction.fxRateToReporting.toString(),
      date: transaction.date.toISOString(),
      notes: transaction.notes,
    })),
    manualQuotes: manualQuotes.map((quote) => ({
      assetType: quote.asset.type,
      assetSymbol: quote.asset.symbol,
      assetMarket: quote.asset.market,
      price: quote.price.toString(),
      currency: quote.currency,
      asOf: quote.asOf.toISOString(),
      active: quote.active,
    })),
  };
}
