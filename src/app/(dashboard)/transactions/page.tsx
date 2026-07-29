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
import { MonthFilter } from "./month-filter";

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<{ accountId?: string; month?: string }>;
}) {
  const { accountId, month } = await searchParams;

  const [
    transactions,
    transactionMonths,
    accounts,
    incomeCategories,
    expenseCategories,
  ] =
    await Promise.all([
      getTransactions({ accountId, month }),
      getTransactionMonths(accountId),
      getAccounts(),
      getCategories("INCOME"),
      getCategories("EXPENSE"),
    ]);

  const filteredAccount = accountId
    ? accounts.find((a) => a.id === accountId)
    : null;

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-xl font-semibold">
          {filteredAccount ? filteredAccount.name : "Transactions"}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <AccountFilter accounts={accounts} />
          <MonthFilter months={transactionMonths} />
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
          <p>{month ? "No transactions in this month" : "No transactions yet"}</p>
          <p className="text-sm">
            {month
              ? "Choose another month or clear the month filter"
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
