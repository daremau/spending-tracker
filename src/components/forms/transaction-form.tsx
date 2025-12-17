"use client";

import { useState } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import type { BankAccount, Category } from "@prisma/client";

interface TransactionFormProps {
  accounts: BankAccount[];
  incomeCategories: Category[];
  expenseCategories: Category[];
}

export function TransactionForm({
  accounts,
  incomeCategories,
  expenseCategories,
}: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    formData.set("type", type);

    const result = await createTransaction(formData);

    if (result?.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setLoading(false);
    setOpen(false);
  }

  const categories = type === "INCOME" ? incomeCategories : expenseCategories;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1">
          <Plus className="h-4 w-4" />
          Add Transaction
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="h-auto max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Transaction</SheetTitle>
          <SheetDescription>
            Record income, expense, or transfer
          </SheetDescription>
        </SheetHeader>

        <Tabs value={type} onValueChange={(v) => setType(v as typeof type)} className="px-4">
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
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">
                {type === "TRANSFER" ? "From Account" : "Account"}
              </Label>
              <Select name="accountId" required>
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
                <Label htmlFor="toAccountId">To Account</Label>
                <Select name="toAccountId" required>
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
                <Label htmlFor="categoryId">Category</Label>
                <Select name="categoryId">
                  <SelectTrigger>
                    <SelectValue placeholder="Select category (optional)" />
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

            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Input
                id="description"
                name="description"
                placeholder="e.g., Grocery shopping"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                name="date"
                type="date"
                defaultValue={new Date().toISOString().split("T")[0]}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading || accounts.length === 0}>
              {loading ? "Adding..." : `Add ${type.charAt(0) + type.slice(1).toLowerCase()}`}
            </Button>

            {accounts.length === 0 && (
              <p className="text-sm text-muted-foreground text-center">
                Add a bank account first to record transactions
              </p>
            )}
          </form>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
