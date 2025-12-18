import { getTransactions } from "@/actions/transactions";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransactionCard } from "./transaction-card";

export default async function TransactionsPage() {
  const [transactions, accounts, incomeCategories, expenseCategories] = await Promise.all([
    getTransactions(),
    getAccounts(),
    getCategories("INCOME"),
    getCategories("EXPENSE"),
  ]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Transactions</h2>
        <TransactionForm
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
        />
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No transactions yet</p>
          <p className="text-sm">Record your first transaction to get started</p>
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
