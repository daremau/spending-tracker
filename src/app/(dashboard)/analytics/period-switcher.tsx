"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnalyticsPeriod, PERIOD_OPTIONS } from "./periods";

interface PeriodSwitcherProps {
  value: AnalyticsPeriod;
  year?: number;
  from?: string;
  to?: string;
  availableYears: number[];
}

function buildUrl(
  pathname: string,
  searchParams: URLSearchParams,
  mutate: (params: URLSearchParams) => void
) {
  const params = new URLSearchParams(searchParams.toString());
  mutate(params);
  const queryString = params.toString();
  return queryString ? `${pathname}?${queryString}` : pathname;
}

function CustomRangeForm({
  initialFrom,
  initialTo,
  disabled,
  onApply,
}: {
  initialFrom: string;
  initialTo: string;
  disabled: boolean;
  onApply: (from: string, to: string) => void;
}) {
  const [fromDraft, setFromDraft] = useState(initialFrom);
  const [toDraft, setToDraft] = useState(initialTo);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        type="date"
        aria-label="From date"
        className="w-[140px] h-8"
        value={fromDraft}
        max={toDraft || undefined}
        onChange={(e) => setFromDraft(e.target.value)}
        disabled={disabled}
      />
      <span className="text-xs text-muted-foreground">to</span>
      <Input
        type="date"
        aria-label="To date"
        className="w-[140px] h-8"
        value={toDraft}
        min={fromDraft || undefined}
        onChange={(e) => setToDraft(e.target.value)}
        disabled={disabled}
      />
      <Button
        size="sm"
        variant="secondary"
        className="h-8"
        onClick={() => onApply(fromDraft, toDraft)}
        disabled={disabled}
      >
        Apply
      </Button>
    </div>
  );
}

export function PeriodSwitcher({
  value,
  year,
  from,
  to,
  availableYears,
}: PeriodSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from(
    new Set([...availableYears, currentYear])
  ).sort((a, b) => b - a);
  const selectedYear = String(year ?? currentYear);

  const navigate = (url: string) => {
    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  };

  const handlePresetChange = (next: AnalyticsPeriod) => {
    navigate(
      buildUrl(pathname, new URLSearchParams(searchParams.toString()), (params) => {
        if (next === "all") {
          params.delete("period");
          params.delete("year");
          params.delete("from");
          params.delete("to");
        } else {
          params.set("period", next);
          if (next !== "year") params.delete("year");
          if (next !== "custom") {
            params.delete("from");
            params.delete("to");
          }
        }
      })
    );
  };

  const handleYearChange = (nextYear: string) => {
    navigate(
      buildUrl(pathname, new URLSearchParams(searchParams.toString()), (params) => {
        params.set("period", "year");
        if (Number(nextYear) === currentYear) {
          params.delete("year");
        } else {
          params.set("year", nextYear);
        }
        params.delete("from");
        params.delete("to");
      })
    );
  };

  const handleCustomApply = (nextFrom: string, nextTo: string) => {
    navigate(
      buildUrl(pathname, new URLSearchParams(searchParams.toString()), (params) => {
        params.set("period", "custom");
        params.delete("year");
        if (nextFrom) params.set("from", nextFrom);
        else params.delete("from");
        if (nextTo) params.set("to", nextTo);
        else params.delete("to");
      })
    );
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Period</span>
        <Select
          value={value}
          onValueChange={(val) => handlePresetChange(val as AnalyticsPeriod)}
          disabled={isPending}
        >
          <SelectTrigger className="w-[150px] h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {value === "year" && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Year</span>
          <Select
            value={selectedYear}
            onValueChange={handleYearChange}
            disabled={isPending || yearOptions.length === 0}
          >
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {value === "custom" && (
        <CustomRangeForm
          key={`custom-${from ?? ""}-${to ?? ""}`}
          initialFrom={from ?? ""}
          initialTo={to ?? ""}
          disabled={isPending}
          onApply={handleCustomApply}
        />
      )}
    </div>
  );
}
