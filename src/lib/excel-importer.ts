import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import {
  ParsedImportData,
  ImportOptions,
  ImportResult,
  ImportStats,
  ImportStrategy,
  AccountRow,
  CategoryRow,
  TransactionRow,
} from "./excel-types";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

function createEmptyStats(): ImportStats {
  return { created: 0, updated: 0, skipped: 0, errors: [] };
}

async function applyTransactionBalance(
  tx: Prisma.TransactionClient,
  data: {
    type: TransactionType;
    amount: number;
    accountId: string;
    toAccountId: string | null;
  }
) {
  if (data.type === "INCOME") {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { increment: data.amount } },
    });
  } else if (data.type === "EXPENSE") {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { decrement: data.amount } },
    });
  } else if (data.type === "TRANSFER" && data.toAccountId) {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { decrement: data.amount } },
    });
    await tx.bankAccount.update({
      where: { id: data.toAccountId },
      data: { balance: { increment: data.amount } },
    });
  }
}

export async function importData(
  data: ParsedImportData,
  options: ImportOptions
): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    accounts: createEmptyStats(),
    categories: createEmptyStats(),
    transactions: createEmptyStats(),
  };

  try {
    await prisma.$transaction(async (tx) => {
      // Phase 1: Import accounts and build name->id map
      const accountMap = await importAccounts(
        tx,
        data.accounts,
        options.accounts,
        result.accounts
      );

      // Phase 2: Import categories and build (name+type)->id map
      const categoryMap = await importCategories(
        tx,
        data.categories,
        options.categories,
        result.categories
      );

      // Phase 3: Import transactions with resolved references
      await importTransactions(
        tx,
        data.transactions,
        options.transactions,
        result.transactions,
        accountMap,
        categoryMap
      );
    });
  } catch (error) {
    result.success = false;
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during import";
    result.accounts.errors.push({
      sheet: "Accounts",
      row: -1,
      message: `Import failed: ${errorMessage}`,
    });
  }

  // Check if any errors occurred
  result.success =
    result.accounts.errors.length === 0 &&
    result.categories.errors.length === 0 &&
    result.transactions.errors.length === 0;

  return result;
}

async function importAccounts(
  tx: Prisma.TransactionClient,
  accounts: AccountRow[],
  strategy: ImportStrategy,
  stats: ImportStats
): Promise<Map<string, string>> {
  const accountMap = new Map<string, string>();

  // Fetch existing accounts
  const existing = await tx.bankAccount.findMany();
  existing.forEach((acc) => accountMap.set(acc.name.toLowerCase(), acc.id));

  for (const account of accounts) {
    const key = account.name.toLowerCase();
    const existingId = accountMap.get(key);

    if (existingId) {
      if (strategy === "skip") {
        stats.skipped++;
      } else if (strategy === "update") {
        await tx.bankAccount.update({
          where: { id: existingId },
          data: {
            balance: account.balance,
            currency: account.currency,
          },
        });
        stats.updated++;
      } else {
        // 'error'
        stats.errors.push({
          sheet: "Accounts",
          row: -1,
          message: `Account "${account.name}" already exists`,
        });
      }
    } else {
      const created = await tx.bankAccount.create({
        data: {
          name: account.name,
          balance: account.balance,
          currency: account.currency,
        },
      });
      accountMap.set(key, created.id);
      stats.created++;
    }
  }

  return accountMap;
}

async function importCategories(
  tx: Prisma.TransactionClient,
  categories: CategoryRow[],
  strategy: ImportStrategy,
  stats: ImportStats
): Promise<Map<string, string>> {
  const categoryMap = new Map<string, string>();

  // Fetch existing categories
  const existing = await tx.category.findMany();
  existing.forEach((cat) => {
    const key = `${cat.name.toLowerCase()}:${cat.type}`;
    categoryMap.set(key, cat.id);
  });

  for (const category of categories) {
    const key = `${category.name.toLowerCase()}:${category.type}`;
    const existingId = categoryMap.get(key);

    if (existingId) {
      if (strategy === "skip") {
        stats.skipped++;
      } else if (strategy === "update") {
        await tx.category.update({
          where: { id: existingId },
          data: {
            color: category.color,
            icon: category.icon,
          },
        });
        stats.updated++;
      } else {
        // 'error'
        stats.errors.push({
          sheet: "Categories",
          row: -1,
          message: `Category "${category.name}" (${category.type}) already exists`,
        });
      }
    } else {
      const created = await tx.category.create({
        data: {
          name: category.name,
          type: category.type,
          color: category.color,
          icon: category.icon,
        },
      });
      categoryMap.set(key, created.id);
      stats.created++;
    }
  }

  return categoryMap;
}

async function importTransactions(
  tx: Prisma.TransactionClient,
  transactions: TransactionRow[],
  strategy: ImportStrategy,
  stats: ImportStats,
  accountMap: Map<string, string>,
  categoryMap: Map<string, string>
): Promise<void> {
  for (let i = 0; i < transactions.length; i++) {
    const transaction = transactions[i];
    const rowNumber = i + 2; // Account for header row and 0-indexing

    // Resolve account reference
    const accountId = accountMap.get(transaction.accountName.toLowerCase());
    if (!accountId) {
      stats.errors.push({
        sheet: "Transactions",
        row: rowNumber,
        message: `Account "${transaction.accountName}" not found`,
      });
      continue;
    }

    // Resolve toAccount reference for transfers
    let toAccountId: string | null = null;
    if (transaction.type === "TRANSFER") {
      if (!transaction.toAccountName) {
        stats.errors.push({
          sheet: "Transactions",
          row: rowNumber,
          message: "Transfer requires a destination account",
        });
        continue;
      }
      toAccountId = accountMap.get(transaction.toAccountName.toLowerCase()) || null;
      if (!toAccountId) {
        stats.errors.push({
          sheet: "Transactions",
          row: rowNumber,
          message: `Destination account "${transaction.toAccountName}" not found`,
        });
        continue;
      }
      if (accountId === toAccountId) {
        stats.errors.push({
          sheet: "Transactions",
          row: rowNumber,
          message: "Cannot transfer to the same account",
        });
        continue;
      }
    }

    // Resolve category reference (optional)
    let categoryId: string | null = null;
    if (transaction.categoryName && transaction.type !== "TRANSFER") {
      // For income, look for INCOME category; for expense, look for EXPENSE
      const categoryType = transaction.type === "INCOME" ? "INCOME" : "EXPENSE";
      const categoryKey = `${transaction.categoryName.toLowerCase()}:${categoryType}`;
      categoryId = categoryMap.get(categoryKey) || null;
      if (!categoryId) {
        stats.errors.push({
          sheet: "Transactions",
          row: rowNumber,
          message: `Category "${transaction.categoryName}" (${categoryType}) not found`,
        });
        continue;
      }
    }

    // Check for duplicate (simple check based on date, amount, account, description)
    const existingTransaction = await tx.transaction.findFirst({
      where: {
        date: transaction.date,
        amount: transaction.amount,
        accountId,
        description: transaction.description,
        type: transaction.type,
      },
    });

    if (existingTransaction) {
      if (strategy === "skip") {
        stats.skipped++;
        continue;
      } else if (strategy === "error") {
        stats.errors.push({
          sheet: "Transactions",
          row: rowNumber,
          message: `Duplicate transaction found (${transaction.type} of ${transaction.amount} on ${transaction.date.toISOString().split("T")[0]})`,
        });
        continue;
      }
      // For 'update' strategy, we skip duplicates since updating makes less sense for transactions
      stats.skipped++;
      continue;
    }

    // Create the transaction
    await tx.transaction.create({
      data: {
        type: transaction.type,
        amount: transaction.amount,
        description: transaction.description,
        date: transaction.date,
        accountId,
        categoryId,
        toAccountId,
      },
    });

    // Apply balance changes
    await applyTransactionBalance(tx, {
      type: transaction.type,
      amount: transaction.amount,
      accountId,
      toAccountId,
    });

    stats.created++;
  }
}
