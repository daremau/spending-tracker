"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SpendingChart } from "@/components/charts/spending-chart";

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

interface CategorySectionProps {
  data: CategoryData[];
  periodLabel: string;
  title: string;
}

export function CategorySection({ data, periodLabel, title }: CategorySectionProps) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(data.map((item) => item.name))
  );

  useEffect(() => {
    setSelected(new Set(data.map((item) => item.name)));
  }, [data]);

  const handleToggle = (name: string, checked: boolean | "indeterminate") => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(name);
      } else {
        next.delete(name);
      }
      return next.size === 0 ? prev : next;
    });
  };

  const showTop = (count: number) => {
    const sorted = [...data].sort((a, b) => b.value - a.value);
    const names = sorted.slice(0, count).map((item) => item.name);
    setSelected(new Set(names.length > 0 ? names : sorted.map((i) => i.name)));
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency: "PYG",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  const filteredData = useMemo(
    () => data.filter((item) => selected.has(item.name)),
    [data, selected]
  );

  const totalFiltered = useMemo(
    () => filteredData.reduce((sum, item) => sum + item.value, 0),
    [filteredData]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => showTop(3)}
              className="h-8"
              disabled={data.length === 0}
            >
              Top 3
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => showTop(5)}
              className="h-8"
              disabled={data.length === 0}
            >
              Top 5
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setSelected(new Set(data.map((item) => item.name)))
              }
              className="h-8"
              disabled={data.length === 0}
            >
              All
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8"
                  disabled={data.length === 0}
                >
                  Categories ({selected.size}/{data.length})
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[220px]">
                <DropdownMenuLabel className="flex items-center gap-2">
                  Choose categories
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {data.map((category) => (
                  <DropdownMenuCheckboxItem
                    key={category.name}
                    checked={selected.has(category.name)}
                    onCheckedChange={(checked) =>
                      handleToggle(category.name, checked)
                    }
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      {category.name}
                    </span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <SpendingChart data={filteredData} />

        {filteredData.length > 0 && (
          <div className="space-y-3">
            {filteredData.map((category) => {
              const percentage =
                totalFiltered > 0
                  ? ((category.value / totalFiltered) * 100).toFixed(1)
                  : "0";
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
