import { prisma } from "@/lib/prisma";
import { preflightBackup } from "./preflight";
import { assetKey, type BackupDataV2 } from "./types";

export type RestoreResult = {
  success: boolean;
  accountsCreated: number;
  categoriesCreated: number;
  transactionsCreated: number;
  assetsCreated: number;
  investmentAccountsCreated: number;
  investmentTransactionsCreated: number;
  errors: string[];
};

function emptyResult(): RestoreResult {
  return {
    success: true,
    accountsCreated: 0,
    categoriesCreated: 0,
    transactionsCreated: 0,
    assetsCreated: 0,
    investmentAccountsCreated: 0,
    investmentTransactionsCreated: 0,
    errors: [],
  };
}

function lower(value: string) {
  return value.trim().toLowerCase();
}

/**
 * Restores a backup atomically.
 *
 * Preflight runs first and aborts before a single row is deleted, so a
 * malformed reference or an oversold ledger leaves the existing database
 * untouched. Everything that survives preflight is then deleted and rewritten
 * inside one Prisma transaction, which means a failure at any point rolls the
 * database back to its pre-restore state.
 */
export async function restoreBackup(
  backup: BackupDataV2
): Promise<RestoreResult> {
  const result = emptyResult();

  const preflight = preflightBackup(backup);
  if (!preflight.ok) {
    return { ...result, success: false, errors: preflight.errors };
  }

  try {
    await prisma.$transaction(
      async (tx) => {
        // Delete children before parents; investment transactions and quotes
        // cascade from their owners but are removed explicitly for clarity.
        await tx.investmentTransaction.deleteMany({});
        await tx.marketQuote.deleteMany({});
        await tx.investmentAccount.deleteMany({});
        await tx.asset.deleteMany({});
        await tx.transaction.deleteMany({});
        await tx.bankAccount.deleteMany({});
        await tx.category.deleteMany({});
        await tx.exchangeRate.deleteMany({});

        await tx.appSettings.upsert({
          where: { id: "singleton" },
          update: {
            reportingCurrency: backup.settings.reportingCurrency,
            timezone: backup.settings.timezone,
          },
          create: {
            id: "singleton",
            reportingCurrency: backup.settings.reportingCurrency,
            timezone: backup.settings.timezone,
          },
        });

        const accountIds = new Map<string, string>();
        for (const account of backup.accounts) {
          const created = await tx.bankAccount.create({
            data: {
              name: account.name,
              balance: account.balance,
              currency: account.currency,
              kind: account.kind,
            },
          });
          accountIds.set(lower(account.name), created.id);
          result.accountsCreated += 1;
        }

        const categoryIds = new Map<string, string>();
        for (const category of backup.categories) {
          const created = await tx.category.create({
            data: {
              name: category.name,
              type: category.type,
              color: category.color,
              icon: category.icon,
            },
          });
          categoryIds.set(`${lower(category.name)}:${category.type}`, created.id);
          result.categoriesCreated += 1;
        }

        for (const rate of backup.exchangeRates) {
          await tx.exchangeRate.create({
            data: {
              fromCurrency: rate.fromCurrency,
              toCurrency: rate.toCurrency,
              source: "MANUAL",
              rate: rate.rate,
              asOf: new Date(rate.asOf),
              active: rate.active,
            },
          });
        }

        // Parents are written before children so the digital-tax link resolves.
        const transactionIds = new Map<string, string>();
        const ordered = [
          ...backup.transactions.filter((entry) => !entry.parentKey),
          ...backup.transactions.filter((entry) => entry.parentKey),
        ];
        for (const transaction of ordered) {
          const accountId = accountIds.get(lower(transaction.accountName));
          if (!accountId) continue;
          const categoryId = transaction.categoryName
            ? (categoryIds.get(
                `${lower(transaction.categoryName)}:${
                  transaction.type === "INCOME" ? "INCOME" : "EXPENSE"
                }`
              ) ?? null)
            : null;
          const toAccountId = transaction.toAccountName
            ? (accountIds.get(lower(transaction.toAccountName)) ?? null)
            : null;
          const parentTransactionId = transaction.parentKey
            ? (transactionIds.get(transaction.parentKey) ?? null)
            : null;

          const created = await tx.transaction.create({
            data: {
              type: transaction.type,
              amount: transaction.amount,
              description: transaction.description,
              date: new Date(transaction.date),
              accountId,
              categoryId,
              toAccountId,
              isDigitalTax: transaction.isDigitalTax,
              parentTransactionId,
            },
          });
          transactionIds.set(transaction.key, created.id);
          result.transactionsCreated += 1;
        }

        const assetIds = new Map<string, string>();
        for (const asset of backup.assets) {
          const created = await tx.asset.create({
            data: {
              type: asset.type,
              symbol: asset.symbol,
              name: asset.name,
              market: asset.market,
              quoteCurrency: asset.quoteCurrency,
              provider: asset.provider,
              providerSymbol: asset.providerSymbol,
              active: asset.active,
            },
          });
          assetIds.set(
            assetKey(asset.type, asset.symbol, asset.market),
            created.id
          );
          result.assetsCreated += 1;
        }

        const investmentAccountIds = new Map<string, string>();
        for (const account of backup.investmentAccounts) {
          const cashAccountId = accountIds.get(lower(account.cashAccountName));
          if (!cashAccountId) continue;
          const created = await tx.investmentAccount.create({
            data: {
              name: account.name,
              type: account.type,
              cashCurrency: account.cashCurrency,
              cashAccountId,
              archivedAt: account.archivedAt
                ? new Date(account.archivedAt)
                : null,
            },
          });
          investmentAccountIds.set(lower(account.name), created.id);
          result.investmentAccountsCreated += 1;
        }

        for (const transaction of backup.investmentTransactions) {
          const accountId = investmentAccountIds.get(
            lower(transaction.accountName)
          );
          if (!accountId) continue;
          const assetId = transaction.assetSymbol
            ? (assetIds.get(
                assetKey(
                  transaction.assetType ?? "",
                  transaction.assetSymbol,
                  transaction.assetMarket ?? ""
                )
              ) ?? null)
            : null;

          await tx.investmentTransaction.create({
            data: {
              clientRequestId: transaction.clientRequestId,
              accountId,
              assetId,
              type: transaction.type,
              quantity: transaction.quantity,
              unitPrice: transaction.unitPrice,
              cashAmount: transaction.cashAmount,
              fees: transaction.fees,
              currency: transaction.currency,
              fxRateToReporting: transaction.fxRateToReporting,
              date: new Date(transaction.date),
              notes: transaction.notes,
            },
          });
          result.investmentTransactionsCreated += 1;
        }

        for (const quote of backup.manualQuotes) {
          const assetId = assetIds.get(
            assetKey(quote.assetType, quote.assetSymbol, quote.assetMarket)
          );
          if (!assetId) continue;
          await tx.marketQuote.create({
            data: {
              assetId,
              source: "MANUAL",
              price: quote.price,
              currency: quote.currency,
              asOf: new Date(quote.asOf),
              active: quote.active,
            },
          });
        }
      },
      { timeout: 120_000 }
    );
  } catch (error) {
    return {
      ...emptyResult(),
      success: false,
      errors: [
        error instanceof Error
          ? `Restore rolled back: ${error.message}`
          : "Restore rolled back: unknown error",
      ],
    };
  }

  return result;
}
