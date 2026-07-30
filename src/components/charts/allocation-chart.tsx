"use client";

import { useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import type { PortfolioAllocationSliceDto } from "@/lib/portfolio/dtos";

interface AllocationChartProps {
  slices: PortfolioAllocationSliceDto[];
  currency: string;
  emptyMessage?: string;
}

export function AllocationChart({
  slices,
  currency,
  emptyMessage = "No allocation to show yet",
}: AllocationChartProps) {
  const [active, setActive] = useState<number | null>(null);

  const format = (value: number) =>
    new Intl.NumberFormat("en-US", {
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);

  if (slices.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  const data = slices.map((slice) => ({ ...slice, amount: Number(slice.value) }));
  const total = data.reduce((sum, slice) => sum + slice.amount, 0);
  const activeSlice = active !== null ? data[active] : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative w-full sm:max-w-[220px]">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={92}
              paddingAngle={1.5}
              dataKey="amount"
              stroke="none"
              isAnimationActive={false}
              onMouseEnter={(_, index) => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              {data.map((slice, index) => (
                <Cell
                  key={slice.key}
                  fill={slice.color}
                  opacity={active === null || active === index ? 1 : 0.3}
                />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-xs text-muted-foreground">
            {activeSlice ? activeSlice.label : currency}
          </span>
          <span className="text-lg font-semibold tabular-nums">
            {format(activeSlice ? activeSlice.amount : total)}
          </span>
          {activeSlice && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {activeSlice.share.toFixed(1)}%
            </span>
          )}
        </div>
      </div>

      {/* The list is the accessible source of truth; the donut only decorates it. */}
      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((slice, index) => (
          <li
            key={slice.key}
            className="flex items-center justify-between gap-3 text-sm"
            onMouseEnter={() => setActive(index)}
            onMouseLeave={() => setActive(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="truncate">
                {slice.label}
                {slice.sublabel && (
                  <span className="text-muted-foreground">
                    {" "}
                    · {slice.sublabel}
                  </span>
                )}
              </span>
            </span>
            <span className="shrink-0 tabular-nums">
              {slice.share.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
