export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingChart } from "@/components/charts/spending-chart";
import { BalanceChart } from "@/components/charts/balance-chart";
import { startOfMonth, subMonths, format } from "date-fns";

async function getAnalyticsData() {
  const now = new Date();
  const sixMonthsAgo = subMonths(startOfMonth(now), 5);

  const currentMonthStart = startOfMonth(now);
  const spendingByCategory = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      type: "EXPENSE",
      date: { gte: currentMonthStart },
    },
    _sum: { amount: true },
  });

  const categories = await prisma.category.findMany({
    where: { type: "EXPENSE" },
  });

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const spendingData = spendingByCategory
    .filter((s) => s.categoryId)
    .map((s) => {
      const category = categoryMap.get(s.categoryId!);
      return {
        name: category?.name || "Unknown",
        value: Number(s._sum.amount) || 0,
        color: category?.color || "#6366f1",
      };
    })
    .sort((a, b) => b.value - a.value);

  const transactions = await prisma.transaction.findMany({
    where: {
      type: { in: ["INCOME", "EXPENSE"] },
      date: { gte: sixMonthsAgo },
    },
    select: {
      type: true,
      amount: true,
      date: true,
    },
  });

  const monthlyData: Record<string, { income: number; expense: number }> = {};

  for (let i = 5; i >= 0; i--) {
    const monthDate = subMonths(now, i);
    const key = format(monthDate, "MMM");
    monthlyData[key] = { income: 0, expense: 0 };
  }

  transactions.forEach((t) => {
    const key = format(new Date(t.date), "MMM");
    if (monthlyData[key]) {
      if (t.type === "INCOME") {
        monthlyData[key].income += Number(t.amount);
      } else {
        monthlyData[key].expense += Number(t.amount);
      }
    }
  });

  const balanceData = Object.entries(monthlyData).map(([name, data]) => ({
    name,
    income: data.income,
    expense: data.expense,
  }));

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    spendingData,
    balanceData,
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
  };
}

export default async function AnalyticsPage() {
  const { spendingData, balanceData, totalIncome, totalExpense, netSavings } =
    await getAnalyticsData();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">Analytics</h2>

      <div className="grid grid-cols-3 gap-2">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Income</p>
            <p className="text-sm font-semibold text-green-600">
              {formatCurrency(totalIncome)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Expenses</p>
            <p className="text-sm font-semibold text-red-500">
              {formatCurrency(totalExpense)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground">Net</p>
            <p
              className={`text-sm font-semibold ${
                netSavings >= 0 ? "text-green-600" : "text-red-500"
              }`}
            >
              {formatCurrency(netSavings)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Income vs Expenses</CardTitle>
          <p className="text-xs text-muted-foreground">Last 6 months</p>
        </CardHeader>
        <CardContent>
          <BalanceChart data={balanceData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Spending by Category</CardTitle>
          <p className="text-xs text-muted-foreground">This month</p>
        </CardHeader>
        <CardContent>
          <SpendingChart data={spendingData} />
        </CardContent>
      </Card>

      {spendingData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {spendingData.map((category) => {
              const percentage =
                totalExpense > 0
                  ? ((category.value / totalExpense) * 100).toFixed(1)
                  : 0;
              return (
                <div key={category.name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span>{category.name}</span>
                    </div>
                    <span className="font-medium">
                      {formatCurrency(category.value)}
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${percentage}%`,
                        backgroundColor: category.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
