export const dynamic = "force-dynamic";

import {
  getTransactionMonths,
  getTransactions,
} from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransactionCard } from "./transaction-card";
import { AccountFilter } from "./account-filter";
import { AmountFilter } from "./amount-filter";
import { CategoryFilter } from "./category-filter";
import { MonthFilter } from "./month-filter";
import { SourceFilter } from "./source-filter";

const VALID_SOURCES = ["MANUAL", "CHATBOT", "IMPORT"] as const;

function parseAmountParam(value?: string): number | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseExactAmountsParam(value?: string): number[] | undefined {
  if (value == null || value.trim() === "") return undefined;
  const seen = new Set<number>();
  for (const part of value.split(",")) {
    const parsed = parseAmountParam(part);
    if (parsed !== undefined) seen.add(parsed);
    if (seen.size >= 50) break;
  }
  return seen.size > 0 ? Array.from(seen) : undefined;
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{
    accountId?: string;
    month?: string;
    source?: string;
    categoryId?: string;
    minAmount?: string;
    maxAmount?: string;
    exactAmounts?: string;
  }>;
}) {
  const {
    accountId,
    month,
    source,
    categoryId,
    minAmount,
    maxAmount,
    exactAmounts,
  } = await searchParams;
  const sourceFilter = VALID_SOURCES.includes(
    (source ?? "") as (typeof VALID_SOURCES)[number]
  )
    ? (source as (typeof VALID_SOURCES)[number])
    : undefined;

  const [
    transactions,
    transactionMonths,
    accounts,
    incomeCategories,
    expenseCategories,
  ] =
    await Promise.all([
      getTransactions({
        accountId,
        month,
        source: sourceFilter ?? "ALL",
        categoryId: categoryId || undefined,
        minAmount: parseAmountParam(minAmount),
        maxAmount: parseAmountParam(maxAmount),
        exactAmounts: parseExactAmountsParam(exactAmounts),
      }),
      getTransactionMonths(accountId, sourceFilter ?? "ALL"),
      getAccounts(),
      getCategories("INCOME"),
      getCategories("EXPENSE"),
    ]);

  const filteredAccount = accountId
    ? accounts.find((a) => a.id === accountId)
    : null;
  const hasAmountOrCategoryFilter =
    (categoryId ?? "") !== "" ||
    (minAmount ?? "").trim() !== "" ||
    (maxAmount ?? "").trim() !== "" ||
    (exactAmounts ?? "").trim() !== "";

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">
          {filteredAccount ? filteredAccount.name : "Transactions"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <AccountFilter accounts={accounts} />
          <MonthFilter months={transactionMonths} />
          <SourceFilter />
          <CategoryFilter
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
          />
          <AmountFilter />
          <TransactionForm
            accounts={accounts}
            incomeCategories={incomeCategories}
            expenseCategories={expenseCategories}
            defaultAccountId={accountId}
          />
        </div>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>
            {month
              ? "No transactions in this month"
              : hasAmountOrCategoryFilter
                ? "No transactions match these filters"
                : "No transactions yet"}
          </p>
          <p className="text-sm">
            {month || hasAmountOrCategoryFilter
              ? "Try widening or clearing the filters"
              : filteredAccount
                ? "No transactions for this account"
                : "Record your first transaction to get started"}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((transaction) => (
            <TransactionCard
              key={transaction.id}
              transaction={transaction}
              accounts={accounts}
              incomeCategories={incomeCategories}
              expenseCategories={expenseCategories}
            />
          ))}
        </div>
      )}
    </div>
  );
}
