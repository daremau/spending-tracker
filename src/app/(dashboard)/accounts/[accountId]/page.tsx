export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet } from "lucide-react";
import { getAccountById, getAccounts } from "@/actions/accounts";
import { getTransactions } from "@/actions/transactions";
import { getCategories } from "@/actions/categories";
import { TransactionForm } from "@/components/forms/transaction-form";
import { TransactionCard } from "../../transactions/transaction-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ accountId: string }>;
}) {
  const { accountId } = await params;

  const [account, transactions, accounts, incomeCategories, expenseCategories] =
    await Promise.all([
      getAccountById(accountId),
      getTransactions({ accountId }),
      getAccounts(),
      getCategories("INCOME"),
      getCategories("EXPENSE"),
    ]);

  if (!account) {
    notFound();
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "PYG" ? 0 : 2,
      maximumFractionDigits: currency === "PYG" ? 0 : 2,
    }).format(amount);
  };

  const isNegative = account.balance < 0;

  return (
    <div className="p-4 space-y-4">
      {/* Header with back button */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/accounts">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <h1 className="text-xl font-semibold">Account Details</h1>
      </div>

      {/* Account Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-lg">{account.name}</h2>
                <p className="text-sm text-muted-foreground">{account.currency}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Balance</p>
              <p
                className={`text-xl font-bold ${
                  isNegative ? "text-red-500" : "text-green-600"
                }`}
              >
                {formatCurrency(account.balance, account.currency)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Transactions</h2>
        <TransactionForm
          accounts={accounts}
          incomeCategories={incomeCategories}
          expenseCategories={expenseCategories}
          defaultAccountId={accountId}
        />
      </div>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-muted-foreground">
              No transactions yet for this account.
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first transaction using the button above.
            </p>
          </CardContent>
        </Card>
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
