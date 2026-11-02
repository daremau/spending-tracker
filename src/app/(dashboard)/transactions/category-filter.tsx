"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryFilterProps {
  incomeCategories: { id: string; name: string }[];
  expenseCategories: { id: string; name: string }[];
}

export function CategoryFilter({
  incomeCategories,
  expenseCategories,
}: CategoryFilterProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const current = searchParams.get("categoryId") || "all";

  function handleChange(value: string) {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all") {
      params.set("categoryId", value);
    } else {
      params.delete("categoryId");
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  return (
    <Select value={current} onValueChange={handleChange}>
      <SelectTrigger
        className="w-[160px]"
        aria-label="Filtrar por categoría"
      >
        <SelectValue placeholder="All categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All categories</SelectItem>
        {expenseCategories.length > 0 && (
          <SelectGroup>
            <SelectLabel>Expenses</SelectLabel>
            {expenseCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {incomeCategories.length > 0 && (
          <SelectGroup>
            <SelectLabel>Income</SelectLabel>
            {incomeCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  );
}
