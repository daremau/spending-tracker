"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";

function parseAmount(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return parsed;
}

function parseExactAmounts(value: string): number[] {
  const seen = new Set<number>();
  for (const part of value.split(",")) {
    const parsed = parseAmount(part);
    if (parsed !== undefined) seen.add(parsed);
    if (seen.size >= 50) break;
  }
  return Array.from(seen);
}

export function AmountFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [min, setMin] = useState(() => searchParams.get("minAmount") ?? "");
  const [max, setMax] = useState(() => searchParams.get("maxAmount") ?? "");
  const [exact, setExact] = useState(
    () => searchParams.get("exactAmounts") ?? ""
  );
  const isActive =
    searchParams.get("minAmount") != null ||
    searchParams.get("maxAmount") != null ||
    searchParams.get("exactAmounts") != null;

  function push(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  function apply() {
    const params = new URLSearchParams(searchParams);
    const exactValues = parseExactAmounts(exact);
    if (exactValues.length > 0) {
      // Montos exactos tienen prioridad sobre el rango
      params.set("exactAmounts", exactValues.join(","));
      params.delete("minAmount");
      params.delete("maxAmount");
      setMin("");
      setMax("");
      setExact(exactValues.join(", "));
    } else {
      params.delete("exactAmounts");
      setExact("");
      const parsedMin = parseAmount(min);
      const parsedMax = parseAmount(max);
      if (parsedMin !== undefined) {
        params.set("minAmount", String(parsedMin));
      } else {
        params.delete("minAmount");
      }
      if (parsedMax !== undefined) {
        params.set("maxAmount", String(parsedMax));
      } else {
        params.delete("maxAmount");
      }
    }
    push(params);
  }

  function clear() {
    setMin("");
    setMax("");
    setExact("");
    const params = new URLSearchParams(searchParams);
    params.delete("minAmount");
    params.delete("maxAmount");
    params.delete("exactAmounts");
    push(params);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <Input
        type="number"
        min={0}
        inputMode="decimal"
        placeholder="Min $"
        aria-label="Monto mínimo"
        value={min}
        onChange={(event) => setMin(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
        }}
        className="w-[100px]"
      />
      <Input
        type="number"
        min={0}
        inputMode="decimal"
        placeholder="Max $"
        aria-label="Monto máximo"
        value={max}
        onChange={(event) => setMax(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
        }}
        className="w-[100px]"
      />
      <Input
        inputMode="decimal"
        placeholder="Exactos: 100000, 500000"
        aria-label="Montos exactos separados por coma"
        title="Uno o varios montos exactos separados por coma"
        value={exact}
        onChange={(event) => setExact(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") apply();
        }}
        className="w-[200px]"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={apply}
        aria-label="Aplicar filtro de monto"
        title="Aplicar filtro de monto"
      >
        <Check className="h-4 w-4" />
      </Button>
      {isActive && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={clear}
          aria-label="Limpiar filtro de monto"
          title="Limpiar filtro de monto"
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
