"use client";

import { useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

interface SpendingChartProps {
  data: {
    name: string;
    value: number;
    color: string;
  }[];
}

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function SpendingChart({ data }: SpendingChartProps) {
  const [active, setActive] = useState<number | null>(null);

  if (data.length === 0) {
    return (
      <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
        No data available
      </div>
    );
  }

  const total = data.reduce((sum, d) => sum + d.value, 0);
  const activeItem = active !== null ? data[active] : null;

  return (
    <div className="relative w-full">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={78}
            outerRadius={115}
            paddingAngle={1.5}
            dataKey="value"
            stroke="none"
            onMouseEnter={(_, index) => setActive(index)}
            onMouseLeave={() => setActive(null)}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.color}
                opacity={active === null || active === index ? 1 : 0.3}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {activeItem ? (
          <>
            <span className="w-36 truncate text-xs text-muted-foreground">
              {activeItem.name}
            </span>
            <span className="text-lg font-semibold tabular-nums">
              {compactFormat.format(activeItem.value)}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {total > 0 ? ((activeItem.value / total) * 100).toFixed(1) : "0"}%
            </span>
          </>
        ) : (
          <>
            <span className="text-xs text-muted-foreground">Total</span>
            <span className="text-lg font-semibold tabular-nums">
              {compactFormat.format(total)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
