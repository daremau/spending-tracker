import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export interface PivotRow {
  name: string;
  color: string;
  values: number[];
  total: number;
  average: number;
}

interface PivotTableProps {
  months: string[];
  income: PivotRow[];
  expense: PivotRow[];
  periodLabel: string;
}

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullFormat = new Intl.NumberFormat("es-PY", {
  style: "currency",
  currency: "PYG",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const compact = (value: number) =>
  value === 0 ? "—" : compactFormat.format(value);

function cellStyle(value: number, max: number, type: "income" | "expense") {
  if (value <= 0 || max <= 0) return undefined;
  const intensity = Math.min(value / max, 1);
  const alpha = 0.1 + intensity * 0.55;
  const rgb = type === "income" ? "34, 197, 94" : "239, 68, 68";
  return { backgroundColor: `rgba(${rgb}, ${alpha})` };
}

function columnTotals(rows: PivotRow[], monthCount: number) {
  const perMonth = Array.from({ length: monthCount }, (_, i) =>
    rows.reduce((sum, row) => sum + row.values[i], 0)
  );
  const total = perMonth.reduce((sum, v) => sum + v, 0);
  return { perMonth, total, average: monthCount > 0 ? total / monthCount : 0 };
}

const stickyCol =
  "sticky left-0 z-10 bg-background border-r px-2 py-1.5 text-left whitespace-nowrap";
const numCell = "px-2 py-1.5 text-right tabular-nums whitespace-nowrap";

export function PivotTable({
  months,
  income,
  expense,
  periodLabel,
}: PivotTableProps) {
  const hasData = months.length > 0 && (income.length > 0 || expense.length > 0);

  const incomeTotals = columnTotals(income, months.length);
  const expenseTotals = columnTotals(expense, months.length);

  const maxIncomeCell = Math.max(
    1,
    ...income.flatMap((r) => r.values)
  );
  const maxExpenseCell = Math.max(
    1,
    ...expense.flatMap((r) => r.values)
  );

  const net = months.map(
    (_, i) => incomeTotals.perMonth[i] - expenseTotals.perMonth[i]
  );
  const netTotal = incomeTotals.total - expenseTotals.total;
  const savingsPct = months.map((_, i) =>
    incomeTotals.perMonth[i] > 0
      ? (net[i] / incomeTotals.perMonth[i]) * 100
      : null
  );
  const savingsPctTotal =
    incomeTotals.total > 0 ? (netTotal / incomeTotals.total) * 100 : null;

  const renderSection = (
    label: string,
    rows: PivotRow[],
    totals: ReturnType<typeof columnTotals>,
    max: number,
    type: "income" | "expense"
  ) => (
    <>
      <tr className="bg-muted/50">
        <td className={`${stickyCol} bg-muted/50 font-semibold text-xs uppercase tracking-wide`}>
          {label}
        </td>
        <td colSpan={months.length + 2} />
      </tr>
      {rows.map((row) => (
        <tr key={`${type}-${row.name}`} className="border-t">
          <td className={`${stickyCol} font-medium`}>
            <span className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: row.color }}
              />
              {row.name}
            </span>
          </td>
          {row.values.map((value, i) => (
            <td
              key={i}
              className={numCell}
              style={cellStyle(value, max, type)}
              title={fullFormat.format(value)}
            >
              {compact(value)}
            </td>
          ))}
          <td className={`${numCell} font-semibold border-l`} title={fullFormat.format(row.total)}>
            {compact(row.total)}
          </td>
          <td className={`${numCell} text-muted-foreground`} title={fullFormat.format(row.average)}>
            {compact(row.average)}
          </td>
        </tr>
      ))}
      <tr className="border-t-2 font-semibold">
        <td className={stickyCol}>{label} total</td>
        {totals.perMonth.map((value, i) => (
          <td key={i} className={numCell} title={fullFormat.format(value)}>
            {compact(value)}
          </td>
        ))}
        <td className={`${numCell} border-l`} title={fullFormat.format(totals.total)}>
          {compact(totals.total)}
        </td>
        <td className={`${numCell} text-muted-foreground`} title={fullFormat.format(totals.average)}>
          {compact(totals.average)}
        </td>
      </tr>
    </>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Income & Expense Sheet</CardTitle>
        <p className="text-xs text-muted-foreground">
          {periodLabel} · category × month
        </p>
      </CardHeader>
      <CardContent className="p-0">
        {!hasData ? (
          <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
            No data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b">
                  <th className={`${stickyCol} bg-background font-semibold`}>
                    Category
                  </th>
                  {months.map((month) => (
                    <th key={month} className={`${numCell} font-semibold`}>
                      {month}
                    </th>
                  ))}
                  <th className={`${numCell} font-semibold border-l`}>Total</th>
                  <th className={`${numCell} font-semibold text-muted-foreground`}>
                    Avg
                  </th>
                </tr>
              </thead>
              <tbody>
                {income.length > 0 &&
                  renderSection("Income", income, incomeTotals, maxIncomeCell, "income")}
                {expense.length > 0 &&
                  renderSection("Expenses", expense, expenseTotals, maxExpenseCell, "expense")}

                <tr className="border-t-2 font-bold">
                  <td className={stickyCol}>Net</td>
                  {net.map((value, i) => (
                    <td
                      key={i}
                      className={`${numCell} ${value >= 0 ? "text-green-600" : "text-red-500"}`}
                      title={fullFormat.format(value)}
                    >
                      {compact(value)}
                    </td>
                  ))}
                  <td
                    className={`${numCell} border-l ${netTotal >= 0 ? "text-green-600" : "text-red-500"}`}
                    title={fullFormat.format(netTotal)}
                  >
                    {compact(netTotal)}
                  </td>
                  <td className={numCell} />
                </tr>
                <tr className="border-t text-muted-foreground">
                  <td className={`${stickyCol} text-muted-foreground`}>Savings %</td>
                  {savingsPct.map((value, i) => (
                    <td key={i} className={numCell}>
                      {value === null ? "—" : `${value.toFixed(0)}%`}
                    </td>
                  ))}
                  <td className={`${numCell} border-l`}>
                    {savingsPctTotal === null
                      ? "—"
                      : `${savingsPctTotal.toFixed(0)}%`}
                  </td>
                  <td className={numCell} />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
