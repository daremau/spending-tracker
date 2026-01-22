"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AccountFilterProps {
  accounts: { id: string; name: string }[];
}

export function AccountFilter({ accounts }: AccountFilterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentAccountId = searchParams.get("accountId") || "";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set("accountId", value);
    } else {
      params.delete("accountId");
    }
    router.push(`/transactions?${params.toString()}`);
  }

  return (
    <Select value={currentAccountId || "all"} onValueChange={handleChange}>
      <SelectTrigger className="w-[160px]">
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
  );
}
