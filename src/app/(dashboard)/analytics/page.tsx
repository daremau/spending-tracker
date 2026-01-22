export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BalanceChart } from "@/components/charts/balance-chart";
import { addMonths, format, startOfMonth, startOfYear, subMonths } from "date-fns";
import {
  AnalyticsPeriod,
  DEFAULT_PERIOD,
  PERIOD_OPTIONS,
  getPeriodLabel,
} from "./periods";
import { PeriodSwitcher } from "./period-switcher";
import { CategorySection } from "./category-section";

function getDateRange(period: AnalyticsPeriod, now: Date) {
  switch (period) {
    case "month":
      return { start: startOfMonth(now), end: now };
    case "3m":
      return { start: startOfMonth(subMonths(now, 2)), end: now };
    case "6m":
      return { start: startOfMonth(subMonths(now, 5)), end: now };
    case "year":
      return { start: startOfYear(now), end: now };
    default:
      return { start: undefined, end: now };
  }
}

async function getAnalyticsData(period: AnalyticsPeriod) {
  const now = new Date();
  const { start, end } = getDateRange(period, now);
  const dateFilter = start ? { gte: start, lte: end } : undefined;

  const [spendingByCategory, incomeByCategory, categories] = await Promise.all([
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        type: "EXPENSE",
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      _sum: { amount: true },
    }),
    prisma.transaction.groupBy({
      by: ["categoryId"],
      where: {
        type: "INCOME",
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      _sum: { amount: true },
    }),
    prisma.category.findMany({
      where: { type: { in: ["EXPENSE", "INCOME"] } },
    }),
  ]);

  const categoryMap = new Map(categories.map((c) => [c.id, c]));

  const spendingData = spendingByCategory
    .filter((s) => s.categoryId)
    .map((s) => {
      const category = categoryMap.get(s.categoryId!);
      return {
        name: category?.name || "Unknown",
        value: Number(s._sum.amount) || 0,
        color: category?.color || "#ef4444",
      };
    })
    .sort((a, b) => b.value - a.value);

  const incomeData = incomeByCategory
    .filter((s) => s.categoryId)
    .map((s) => {
      const category = categoryMap.get(s.categoryId!);
      return {
        name: category?.name || "Unknown",
        value: Number(s._sum.amount) || 0,
        color: category?.color || "#22c55e",
      };
    })
    .sort((a, b) => b.value - a.value);

  const transactions = await prisma.transaction.findMany({
    where: {
      type: { in: ["INCOME", "EXPENSE"] },
      ...(dateFilter ? { date: dateFilter } : {}),
    },
    select: {
      type: true,
      amount: true,
      date: true,
    },
    orderBy: { date: "asc" },
  });

  const balanceData: { name: string; income: number; expense: number }[] = [];

  if (transactions.length > 0) {
    const firstMonth = startOfMonth(
      dateFilter?.gte ?? new Date(transactions[0].date)
    );
    const lastTransactionDate = new Date(transactions[transactions.length - 1].date);
    const lastMonth = startOfMonth(dateFilter?.lte ?? lastTransactionDate);
    const monthOrder: string[] = [];
    const monthMap = new Map<string, { income: number; expense: number }>();

    for (
      let cursor = firstMonth;
      cursor <= lastMonth;
      cursor = addMonths(cursor, 1)
    ) {
      const key = format(cursor, "MMM yy");
      monthOrder.push(key);
      monthMap.set(key, { income: 0, expense: 0 });
    }

    transactions.forEach((t) => {
      const key = format(startOfMonth(new Date(t.date)), "MMM yy");
      const month = monthMap.get(key);
      if (month) {
        if (t.type === "INCOME") {
          month.income += Number(t.amount);
        } else {
          month.expense += Number(t.amount);
        }
      }
    });

    balanceData.push(
      ...monthOrder.map((key) => {
        const month = monthMap.get(key)!;
        return { name: key, income: month.income, expense: month.expense };
      })
    );
  }

  const totalIncome = transactions
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = transactions
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    spendingData,
    incomeData,
    balanceData,
    totalIncome,
    totalExpense,
    netSavings: totalIncome - totalExpense,
    periodLabel: getPeriodLabel(period),
  };
}

interface AnalyticsPageProps {
  searchParams?: {
    period?: string;
  };
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const periodParam = (searchParams?.period as AnalyticsPeriod) ?? DEFAULT_PERIOD;
  const period = PERIOD_OPTIONS.some((option) => option.value === periodParam)
    ? periodParam
    : DEFAULT_PERIOD;

  const {
    spendingData,
    incomeData,
    balanceData,
    totalIncome,
    totalExpense,
    netSavings,
    periodLabel,
  } = await getAnalyticsData(period);

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
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <PeriodSwitcher value={period} />
      </div>

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
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <BalanceChart data={balanceData} />
        </CardContent>
      </Card>

      <CategorySection
        data={spendingData}
        periodLabel={periodLabel}
        title="Spending by Category"
      />

      <CategorySection
        data={incomeData}
        periodLabel={periodLabel}
        title="Income by Category"
      />
    </div>
  );
}
