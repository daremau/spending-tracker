"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

export type UICategory = { id: string; name: string; type: string };
export type UIAccount = { id: string; name: string };

export type UIDraft = {
  key: string;
  merchant: string;
  amount: number;
  date: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER" | null;
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  description: string | null;
  applyDigitalTax: boolean;
  needsClarification: boolean;
  clarificationQuestion: string | null;
  memoryApplied?: boolean;
};

export function DraftReviewTable({
  drafts,
  accounts,
  incomeCategories,
  expenseCategories,
  onChange,
  onRemove,
}: {
  drafts: UIDraft[];
  accounts: UIAccount[];
  incomeCategories: UICategory[];
  expenseCategories: UICategory[];
  onChange: (key: string, patch: Partial<UIDraft>) => void;
  onRemove: (key: string) => void;
}) {
  if (drafts.length === 0) return null;

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">
        Revisa y confirma ({drafts.length})
      </div>
      {drafts.map((d, i) => {
        const cats =
          d.type === "INCOME" ? incomeCategories : expenseCategories;
        const invalid = !d.type || !d.amount || !d.accountId;
        return (
          <div
            key={d.key}
            className={`space-y-2 rounded-lg border p-3 ${invalid ? "border-amber-400" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                #{i + 1}
              </span>
              <Input
                value={d.merchant}
                onChange={(e) => onChange(d.key, { merchant: e.target.value })}
                className="h-8 flex-1"
                aria-label="Comercio"
              />
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={() => onRemove(d.key)}
                aria-label="Quitar"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            {d.needsClarification && d.clarificationQuestion && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                {d.clarificationQuestion}
                {d.memoryApplied ? " (sugerido por memoria)" : ""}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Input
                type="number"
                min={1}
                value={Number.isFinite(d.amount) ? d.amount : ""}
                onChange={(e) =>
                  onChange(d.key, { amount: Number(e.target.value) })
                }
                className="h-8"
                aria-label="Monto"
              />
              <Input
                type="date"
                value={d.date}
                onChange={(e) => onChange(d.key, { date: e.target.value })}
                className="h-8"
                aria-label="Fecha"
              />
              <Select
                value={d.type ?? ""}
                onValueChange={(v) =>
                  onChange(d.key, {
                    type: v as UIDraft["type"],
                    categoryId:
                      v === "TRANSFER" ? null : d.categoryId,
                    needsClarification: false,
                  })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Gasto</SelectItem>
                  <SelectItem value="INCOME">Ingreso</SelectItem>
                  <SelectItem value="TRANSFER">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Select
                value={d.accountId ?? ""}
                onValueChange={(v) =>
                  onChange(d.key, { accountId: v, needsClarification: false })
                }
              >
                <SelectTrigger className="h-8">
                  <SelectValue placeholder="Cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {d.type === "TRANSFER" ? (
                <Select
                  value={d.toAccountId ?? ""}
                  onValueChange={(v) => onChange(d.key, { toAccountId: v })}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Destino" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Select
                  value={d.categoryId ?? ""}
                  onValueChange={(v) =>
                    onChange(d.key, {
                      categoryId: v,
                      needsClarification: false,
                    })
                  }
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    {cats.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {d.type === "EXPENSE" && (
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={d.applyDigitalTax}
                  onChange={(e) =>
                    onChange(d.key, { applyDigitalTax: e.target.checked })
                  }
                  className="h-3.5 w-3.5"
                />
                Aplicar IVA Digital (10%)
              </label>
            )}
          </div>
        );
      })}
    </div>
  );
}
