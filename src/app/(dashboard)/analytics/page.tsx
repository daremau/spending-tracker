export const dynamic = 'force-dynamic';

import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { getTransactionYears } from "@/actions/transactions";
import { getNetWorthSummary } from "@/actions/portfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { BalanceChart } from "@/components/charts/balance-chart";
import { addMonths, format, startOfMonth } from "date-fns";
import {
  AnalyticsFilter,
  DEFAULT_PERIOD,
  getPeriodLabel,
  isAnalyticsPeriod,
  parseYearParam,
  resolveDateRange,
} from "./periods";
import { PeriodSwitcher } from "./period-switcher";
import { CategorySection } from "./category-section";
import { PivotTable, type PivotRow } from "./pivot-table";

async function getAnalyticsData(filter: AnalyticsFilter) {
  const now = new Date();
  const { start, end } = resolveDateRange(filter, now);
  const dateFilter = start ? { gte: start, lte: end } : undefined;

  const [spendingByCategory, incomeByCategory, categories, p2pAggregate] =
    await Promise.all([
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
      prisma.transaction.aggregate({
        where: {
          type: "P2P",
          ...(dateFilter ? { date: dateFilter } : {}),
        },
        _sum: { amount: true },
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
      categoryId: true,
    },
    orderBy: { date: "asc" },
  });

  const balanceData: { name: string; income: number; expense: number }[] = [];
  let monthOrder: string[] = [];

  if (transactions.length > 0) {
    const firstMonth = startOfMonth(
      dateFilter?.gte ?? new Date(transactions[0].date)
    );
    const lastTransactionDate = new Date(transactions[transactions.length - 1].date);
    const lastMonth = startOfMonth(dateFilter?.lte ?? lastTransactionDate);
    monthOrder = [];
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

  // Pivot matrix: categories (rows) x months (columns), one section per type
  const buildPivotRows = (type: "INCOME" | "EXPENSE"): PivotRow[] => {
    const byCategory = new Map<string, Map<string, number>>();
    transactions.forEach((t) => {
      if (t.type !== type || !t.categoryId) return;
      const monthKey = format(startOfMonth(new Date(t.date)), "MMM yy");
      if (!byCategory.has(t.categoryId)) byCategory.set(t.categoryId, new Map());
      const row = byCategory.get(t.categoryId)!;
      row.set(monthKey, (row.get(monthKey) ?? 0) + Number(t.amount));
    });

    return Array.from(byCategory.entries())
      .map(([categoryId, row]) => {
        const category = categoryMap.get(categoryId);
        const values = monthOrder.map((month) => row.get(month) ?? 0);
        const total = values.reduce((sum, v) => sum + v, 0);
        return {
          name: category?.name || "Unknown",
          color: category?.color || (type === "INCOME" ? "#22c55e" : "#ef4444"),
          values,
          total,
          average: monthOrder.length > 0 ? total / monthOrder.length : 0,
        };
      })
      .sort((a, b) => b.total - a.total);
  };

  const pivot = {
    months: monthOrder,
    income: buildPivotRows("INCOME"),
    expense: buildPivotRows("EXPENSE"),
  };

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
    pivot,
    totalIncome,
    totalExpense,
    totalP2P: Number(p2pAggregate._sum.amount) || 0,
    netSavings: totalIncome - totalExpense,
    periodLabel: getPeriodLabel(filter, now),
  };
}

interface AnalyticsPageProps {
  searchParams?: Promise<{
    period?: string;
    year?: string;
    from?: string;
    to?: string;
  }>;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const resolvedSearchParams = await searchParams;
  const rawPeriod = resolvedSearchParams?.period;
  const period = isAnalyticsPeriod(rawPeriod) ? rawPeriod : DEFAULT_PERIOD;
  const filter: AnalyticsFilter = {
    period,
    year: parseYearParam(resolvedSearchParams?.year),
    from:
      typeof resolvedSearchParams?.from === "string"
        ? resolvedSearchParams.from
        : undefined,
    to:
      typeof resolvedSearchParams?.to === "string"
        ? resolvedSearchParams.to
        : undefined,
  };

  const [
    {
      spendingData,
      incomeData,
      balanceData,
      pivot,
      totalIncome,
      totalExpense,
      totalP2P,
      netSavings,
      periodLabel,
    },
    availableYears,
    netWorth,
  ] = await Promise.all([getAnalyticsData(filter), getTransactionYears(), getNetWorthSummary()]);
  const showInvestments =
    process.env.PORTFOLIO_ENABLED === "true" && netWorth.hasInvestments;
  const portfolioPlusNet =
    netWorth.investmentValueReporting !== null
      ? Number(netWorth.investmentValueReporting) + netSavings
      : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatReportingCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: netWorth.reportingCurrency,
      minimumFractionDigits: netWorth.reportingCurrency === "PYG" ? 0 : 2,
      maximumFractionDigits: netWorth.reportingCurrency === "PYG" ? 0 : 2,
    }).format(amount);
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Analytics</h2>
        <PeriodSwitcher
          value={filter.period}
          year={filter.year}
          from={filter.from}
          to={filter.to}
          availableYears={availableYears}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
            <p className="text-xs text-muted-foreground">P2P (no gasto)</p>
            <p className="text-sm font-semibold text-indigo-500">
              {formatCurrency(totalP2P)}
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

      {showInvestments && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Portfolio + Net</CardTitle>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/portfolio" className="text-primary">
                  View Portfolio
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Link>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Net follows the selected period; portfolio is a point-in-time
              snapshot
            </p>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Portfolio</dt>
                <dd className="font-semibold tabular-nums">
                  {netWorth.investmentValueReporting !== null
                    ? formatReportingCurrency(
                        Number(netWorth.investmentValueReporting)
                      )
                    : "Unavailable"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Net</dt>
                <dd
                  className={`font-semibold tabular-nums ${
                    netSavings >= 0 ? "text-green-600" : "text-red-500"
                  }`}
                >
                  {formatCurrency(netSavings)}
                </dd>
              </div>
              <div className="col-span-2 border-t pt-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="text-base font-bold tabular-nums">
                  {portfolioPlusNet !== null
                    ? formatCurrency(portfolioPlusNet)
                    : "Unavailable"}
                </dd>
              </div>
            </dl>
            {netWorth.investmentValueReporting === null && (
              <p className="text-xs text-muted-foreground mt-2">
                {netWorth.missingQuotes.length > 0 &&
                  `Missing prices: ${netWorth.missingQuotes.join(", ")}. `}
                {netWorth.missingRates.length > 0 &&
                  `Missing ${netWorth.missingRates.join(", ")} conversion in Currency settings.`}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Income vs Expenses</CardTitle>
          <p className="text-xs text-muted-foreground">{periodLabel}</p>
        </CardHeader>
        <CardContent>
          <BalanceChart data={balanceData} />
        </CardContent>
      </Card>

      <PivotTable
        months={pivot.months}
        income={pivot.income}
        expense={pivot.expense}
        periodLabel={periodLabel}
      />

      <CategorySection
        key={`spending-${periodLabel}`}
        data={spendingData}
        periodLabel={periodLabel}
        title="Spending by Category"
      />

      <CategorySection
        key={`income-${periodLabel}`}
        data={incomeData}
        periodLabel={periodLabel}
        title="Income by Category"
      />
    </div>
  );
}
