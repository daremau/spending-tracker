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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, TrendingUp, TrendingDown, ArrowLeftRight } from "lucide-react";
import { createTransaction } from "@/actions/transactions";
import { createCategory } from "@/actions/categories";
import type { Category } from "@prisma/client";

interface TransactionFormProps {
  accounts: { id: string; name: string }[];
  incomeCategories: Category[];
  expenseCategories: Category[];
  defaultAccountId?: string;
}

export function TransactionForm({
  accounts,
  incomeCategories: initialIncomeCategories,
  expenseCategories: initialExpenseCategories,
  defaultAccountId,
}: TransactionFormProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<"INCOME" | "EXPENSE" | "TRANSFER">("EXPENSE");
  const [applyDigitalTax, setApplyDigitalTax] = useState(false);

  // Category state
  const [incomeCategories, setIncomeCategories] = useState(initialIncomeCategories);
  const [expenseCategories, setExpenseCategories] = useState(initialExpenseCategories);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newCategoryColor, setNewCategoryColor] = useState("#6366f1");
  const [categoryLoading, setCategoryLoading] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  async function handleCreateCategory() {
    if (!newCategoryName.trim()) return;

    setCategoryLoading(true);
    setCategoryError(null);

    const formData = new FormData();
    formData.set("name", newCategoryName.trim());
    formData.set("type", type);
    formData.set("color", newCategoryColor);

    const result = await createCategory(formData);

    if (result?.error) {
      setCategoryError(result.error);
      setCategoryLoading(false);
      return;
    }

    if (result?.category) {
      if (type === "INCOME") {
        setIncomeCategories([...incomeCategories, result.category]);
      } else {
        setExpenseCategories([...expenseCategories, result.category]);
      }
      setSelectedCategoryId(result.category.id);
    }
    setNewCategoryName("");
    setNewCategoryColor("#6366f1");
    setCategoryLoading(false);
    setCategoryDialogOpen(false);
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);

    formData.set("type", type);
    formData.set("applyDigitalTax", applyDigitalTax ? "true" : "false");

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
              <Select name="accountId" defaultValue={defaultAccountId} required>
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
                <div className="flex gap-2">
                  <Select
                    name="categoryId"
                    required
                    value={selectedCategoryId}
                    onValueChange={setSelectedCategoryId}
                  >
                    <SelectTrigger className="flex-1">
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

                  <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
                    <DialogTrigger asChild>
                      <Button type="button" variant="outline" size="icon">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[350px]">
                      <DialogHeader>
                        <DialogTitle>Nueva Categoria</DialogTitle>
                        <DialogDescription>
                          Crear categoria de {type === "INCOME" ? "ingreso" : "gasto"}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        {categoryError && (
                          <div className="p-2 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                            {categoryError}
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label htmlFor="newCategoryName">Nombre</Label>
                          <Input
                            id="newCategoryName"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="ej: Comida"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="newCategoryColor">Color</Label>
                          <div className="flex gap-2">
                            <Input
                              id="newCategoryColor"
                              type="color"
                              value={newCategoryColor}
                              onChange={(e) => setNewCategoryColor(e.target.value)}
                              className="w-14 h-10 p-1 cursor-pointer"
                            />
                            <Input
                              value={newCategoryColor}
                              onChange={(e) => setNewCategoryColor(e.target.value)}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          className="w-full"
                          onClick={handleCreateCategory}
                          disabled={categoryLoading || !newCategoryName.trim()}
                        >
                          {categoryLoading ? "Creando..." : "Crear Categoria"}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            )}

            {type === "EXPENSE" && (
              <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-md">
                <input
                  type="checkbox"
                  id="applyDigitalTax"
                  checked={applyDigitalTax}
                  onChange={(e) => setApplyDigitalTax(e.target.checked)}
                  className="h-4 w-4 rounded border-amber-300 text-amber-600 focus:ring-amber-500"
                />
                <div className="flex-1">
                  <Label htmlFor="applyDigitalTax" className="text-sm font-medium cursor-pointer">
                    Aplicar IVA Digital (10%)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ley 6380 - Se creará una transacción adicional del 10%
                  </p>
                </div>
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
                lang="es"
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
