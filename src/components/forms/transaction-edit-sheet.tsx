"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pencil, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { updateTransaction } from "@/actions/transactions";
import type { Category } from "@prisma/client";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

interface TransactionEditSheetProps {
  transaction: {
    id: string;
    type: TransactionType;
    amount: number;
    description: string | null;
    date: Date | string;
    account: { id: string };
    toAccount: { id: string } | null;
    category: { id: string } | null;
    isDigitalTax?: boolean;
    taxTransaction?: { id: string; amount: number } | null;
  };
  accounts: { id: string; name: string }[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  trigger?: ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function TransactionEditSheet({
  transaction,
  accounts,
  incomeCategories,
  expenseCategories,
  trigger,
  open,
  onOpenChange,
}: TransactionEditSheetProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TransactionType>(transaction.type);
  const [accountId, setAccountId] = useState(transaction.account.id);
  const [toAccountId, setToAccountId] = useState(transaction.toAccount?.id ?? "");
  const [categoryId, setCategoryId] = useState(transaction.category?.id ?? "");
  const [applyDigitalTax, setApplyDigitalTax] = useState(!!transaction.taxTransaction);
  const isOpen = typeof open === "boolean" ? open : uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const isDigitalTaxTransaction = transaction.isDigitalTax ?? false;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    formData.set("id", transaction.id);
    formData.set("type", type);
    formData.set("applyDigitalTax", applyDigitalTax ? "true" : "false");

    if (type === "TRANSFER") {
      formData.set("categoryId", "");
    } else {
      formData.set("toAccountId", "");
    }

    const result = await updateTransaction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    setOpen(false);
  }

  const categories = type === "INCOME" ? incomeCategories : expenseCategories;

  function handleTypeChange(value: string) {
    const nextType = value as TransactionType;
    setType(nextType);
    if (nextType === "TRANSFER") {
      setCategoryId("");
    } else {
      setToAccountId("");
      setCategoryId("");
    }
  }

  const formattedDate = new Date(transaction.date).toISOString().split("T")[0];

  const resolvedTrigger =
    trigger === undefined ? (
      <Button variant="ghost" className="w-full justify-start px-2">
        <Pencil className="mr-2 h-4 w-4" />
        Edit
      </Button>
    ) : (
      trigger
    );

  return (
    <Sheet open={isOpen} onOpenChange={setOpen}>
      {resolvedTrigger !== null && (
        <SheetTrigger asChild>{resolvedTrigger}</SheetTrigger>
      )}
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Transaction</SheetTitle>
          <SheetDescription>Update the details of this transaction</SheetDescription>
        </SheetHeader>

        <Tabs value={type} onValueChange={handleTypeChange} className="px-4">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="INCOME" className="gap-1">
              <TrendingUp className="h-4 w-4" />
              Income
            </TabsTrigger>
            <TabsTrigger value="EXPENSE" className="gap-1">
              <TrendingDown className="h-4 w-4" />
              Expense
            </TabsTrigger>
            <TabsTrigger value="TRANSFER" className="gap-1">
              <ArrowLeftRight className="h-4 w-4" />
              Transfer
            </TabsTrigger>
          </TabsList>

          <form action={handleSubmit} className="space-y-4 pb-6">
            {isDigitalTaxTransaction && (
              <div className="p-3 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
                Esta es una transacción de IVA Digital. Para modificarla, edita la transacción original.
              </div>
            )}

            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-amount">Amount</Label>
              <Input
                id="edit-amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                defaultValue={transaction.amount}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-accountId">
                {type === "TRANSFER" ? "From Account" : "Account"}
              </Label>
              <Select name="accountId" value={accountId} onValueChange={setAccountId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {type === "TRANSFER" && (
              <div className="space-y-2">
                <Label htmlFor="edit-toAccountId">To Account</Label>
                <Select
                  name="toAccountId"
                  value={toAccountId}
                  onValueChange={setToAccountId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select destination account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type !== "TRANSFER" && (
              <div className="space-y-2">
                <Label htmlFor="edit-categoryId">Category</Label>
                <Select
                  name="categoryId"
                  value={categoryId}
                  onValueChange={setCategoryId}
                  required
                  disabled={isDigitalTaxTransaction}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: category.color }}
                          />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {type === "EXPENSE" && !isDigitalTaxTransaction && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
                <input
                  type="checkbox"
                  id="edit-applyDigitalTax"
                  checked={applyDigitalTax}
                  onChange={(e) => setApplyDigitalTax(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <Label htmlFor="edit-applyDigitalTax" className="text-sm font-medium cursor-pointer">
                    Aplicar IVA Digital (10%)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {transaction.taxTransaction
                      ? `Tiene IVA asociado de ${transaction.taxTransaction.amount.toLocaleString()}`
                      : "Ley 6380 - Se creará una transacción adicional del 10%"}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description (optional)</Label>
              <Input
                id="edit-description"
                name="description"
                placeholder="e.g., Grocery shopping"
                defaultValue={transaction.description ?? ""}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-date">Date</Label>
              <Input
                id="edit-date"
                name="date"
                type="date"
                lang="es"
                defaultValue={formattedDate}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || accounts.length === 0 || isDigitalTaxTransaction}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
