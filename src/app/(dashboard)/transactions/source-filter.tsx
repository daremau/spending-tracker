"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SourceFilter() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("source") || "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set("source", value);
    } else {
      params.delete("source");
    }
    router.push(`/transactions?${params.toString()}`);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger className="w-[130px]" aria-label="Filtrar por origen">
        <SelectValue placeholder="Origen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todo origen</SelectItem>
        <SelectItem value="MANUAL">Manual</SelectItem>
        <SelectItem value="CHATBOT">Bot</SelectItem>
        <SelectItem value="IMPORT">Import</SelectItem>
      </SelectContent>
    </Select>
  );
}
