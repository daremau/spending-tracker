"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const VALID_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;

interface MonthFilterProps {
  months: string[];
}

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatMonth(month: string) {
  return monthFormatter.format(new Date(`${month}-01T00:00:00.000Z`));
}

export function MonthFilter({ months }: MonthFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const monthParam = searchParams.get("month") ?? "";
  const currentMonth = VALID_MONTH.test(monthParam) ? monthParam : "";
  const availableMonths =
    currentMonth && !months.includes(currentMonth)
      ? [currentMonth, ...months]
      : months;

  function updateMonth(month: string) {
    const params = new URLSearchParams(searchParams);

    if (VALID_MONTH.test(month)) {
      params.set("month", month);
    } else {
      params.delete("month");
    }

    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select
      value={currentMonth || "all"}
      onValueChange={updateMonth}
    >
      <SelectTrigger
        aria-label="Filter transactions by month"
        className="w-[180px]"
      >
        <SelectValue placeholder="All months" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All months</SelectItem>
        {availableMonths.map((month) => (
          <SelectItem key={month} value={month}>
            {formatMonth(month)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
