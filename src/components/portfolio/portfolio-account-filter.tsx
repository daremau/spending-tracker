"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PortfolioAccountOptionDto } from "@/lib/portfolio/dtos";

export function PortfolioAccountFilter({
  accounts,
}: {
  accounts: PortfolioAccountOptionDto[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("accountId") ?? "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value === "all") {
      params.delete("accountId");
    } else {
      params.set("accountId", value);
    }
    const query = params.toString();
    router.push(query ? `/portfolio?${query}` : "/portfolio");
  }

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="portfolio-account-filter" className="sr-only">
        Filter positions by investment account
      </Label>
      <Select value={current} onValueChange={handleChange}>
        <SelectTrigger id="portfolio-account-filter" className="w-[180px]">
          <SelectValue placeholder="All accounts" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All accounts</SelectItem>
          {accounts.map((account) => (
            <SelectItem key={account.id} value={account.id}>
              {account.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
