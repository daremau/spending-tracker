import Link from "next/link";
import { getAccounts } from "@/actions/accounts";
import { getTransactions } from "@/actions/transactions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
} from "lucide-react";

export default async function DashboardPage() {
  const [accounts, recentTransactions] = await Promise.all([
    getAccounts(),
    getTransactions(5),
  ]);

  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.balance),
    0
  );

  const thisMonth = new Date();
  thisMonth.setDate(1);
  thisMonth.setHours(0, 0, 0, 0);

  const monthlyTransactions = recentTransactions.filter(
    (t) => new Date(t.date) >= thisMonth
  );

  const monthlyIncome = monthlyTransactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const monthlyExpenses = monthlyTransactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Total Balance Card */}
      <Card className="bg-primary text-primary-foreground">
        <CardContent className="p-6">
          <p className="text-sm opacity-80">Total Balance</p>
          <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
          <p className="text-sm opacity-80 mt-2">
            Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
          </p>
        </CardContent>
      </Card>

      {/* Monthly Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Income</span>
            </div>
            <p className="text-xl font-semibold mt-1">{formatCurrency(monthlyIncome)}</p>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-500">
              <TrendingDown className="h-4 w-4" />
              <span className="text-sm">Expenses</span>
            </div>
            <p className="text-xl font-semibold mt-1">{formatCurrency(monthlyExpenses)}</p>
            <p className="text-xs text-muted-foreground">This month</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {accounts.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
            <h3 className="font-semibold mt-4">Get Started</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Add your first bank account to start tracking
            </p>
            <Button asChild className="mt-4">
              <Link href="/accounts">
                <Plus className="h-4 w-4 mr-2" />
                Add Account
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Accounts Preview */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Accounts</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/accounts" className="text-primary">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.slice(0, 3).map((account) => (
              <div key={account.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">{account.name}</span>
                </div>
                <span
                  className={`font-semibold text-sm ${
                    Number(account.balance) >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {formatCurrency(Number(account.balance))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      {recentTransactions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Transactions</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/transactions" className="text-primary">
                  View All
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentTransactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-full flex items-center justify-center ${
                      transaction.type === "INCOME"
                        ? "bg-green-100"
                        : transaction.type === "EXPENSE"
                        ? "bg-red-100"
                        : "bg-blue-100"
                    }`}
                  >
                    {transaction.type === "INCOME" ? (
                      <TrendingUp className="h-4 w-4 text-green-600" />
                    ) : transaction.type === "EXPENSE" ? (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    ) : (
                      <ArrowRight className="h-4 w-4 text-blue-500" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-sm">
                      {transaction.description || transaction.type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {transaction.account.name}
                    </p>
                  </div>
                </div>
                <span
                  className={`font-semibold text-sm ${
                    transaction.type === "INCOME"
                      ? "text-green-600"
                      : transaction.type === "EXPENSE"
                      ? "text-red-500"
                      : "text-blue-500"
                  }`}
                >
                  {transaction.type === "INCOME" ? "+" : transaction.type === "EXPENSE" ? "-" : ""}
                  {formatCurrency(Number(transaction.amount))}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
