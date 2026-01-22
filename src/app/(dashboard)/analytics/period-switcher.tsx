"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AnalyticsPeriod,
  PERIOD_OPTIONS,
} from "./periods";

interface PeriodSwitcherProps {
  value: AnalyticsPeriod;
}

export function PeriodSwitcher({ value }: PeriodSwitcherProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleChange = (next: AnalyticsPeriod) => {
    const params = new URLSearchParams(searchParams);

    if (next === "all") {
      params.delete("period");
    } else {
      params.set("period", next);
    }

    const queryString = params.toString();
    const url = queryString ? `${pathname}?${queryString}` : pathname;

    startTransition(() => {
      router.replace(url, { scroll: false });
    });
  };

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Period</span>
      <Select
        value={value}
        onValueChange={(val) => handleChange(val as AnalyticsPeriod)}
        disabled={isPending}
      >
        <SelectTrigger className="w-[160px] h-8">
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
  );
}
