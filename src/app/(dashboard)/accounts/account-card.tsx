"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreVertical, Pencil, Trash2, Wallet } from "lucide-react";
import { deleteAccount } from "@/actions/accounts";
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

export function AccountCard({ account }: AccountCardProps) {
  const [loading, setLoading] = useState(false);

  const isNegative = account.balance < 0;

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this account? All transactions will be deleted.")) {
      return;
    }

    setLoading(true);
    await deleteAccount(account.id);
    setLoading(false);
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
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
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={loading}
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
    </Card>
  );
}
