"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MoreVertical, Pencil, Trash2, Wallet } from "lucide-react";
import { deleteAccount, updateAccount } from "@/actions/accounts";
interface AccountCardProps {
  account: {
    id: string;
    name: string;
    balance: number;
    currency: string;
    createdAt: Date;
    updatedAt: Date;
  };
}

const currencies = ["PYG", "USD", "EUR", "GBP", "BRL", "ARS"];

export function AccountCard({ account }: AccountCardProps) {
  const [deleting, setDeleting] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNegative = account.balance < 0;

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this account? All transactions will be deleted.")) {
      return;
    }

    setDeleting(true);
    await deleteAccount(account.id);
    setDeleting(false);
  }

  async function handleUpdate(formData: FormData) {
    setSaving(true);
    setError(null);

    const result = await updateAccount(account.id, formData);

    if (result?.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    setSaving(false);
    setEditOpen(false);
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "PYG" ? 0 : 2,
      maximumFractionDigits: currency === "PYG" ? 0 : 2,
    }).format(amount);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium">{account.name}</h3>
              <p className="text-xs text-muted-foreground">{account.currency}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-lg font-semibold ${
                isNegative ? "text-red-500" : "text-green-600"
              }`}
            >
              {formatCurrency(account.balance, account.currency)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="h-auto max-h-[90vh]">
          <SheetHeader>
            <SheetTitle>Edit Bank Account</SheetTitle>
            <SheetDescription>
              Update the account name or currency.
            </SheetDescription>
          </SheetHeader>
          <form action={handleUpdate} className="space-y-4 px-4 pb-6">
            {error && (
              <div className="p-3 text-sm text-red-500 bg-red-50 dark:bg-red-950 rounded-md">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor={`name-${account.id}`}>Account Name</Label>
              <Input
                id={`name-${account.id}`}
                name="name"
                defaultValue={account.name}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`currency-${account.id}`}>Currency</Label>
              <Select name="currency" defaultValue={account.currency}>
                <SelectTrigger id={`currency-${account.id}`}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      {currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </Card>
  );
}
