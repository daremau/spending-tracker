"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MoreVertical,
  Trash2,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
} from "lucide-react";
import { deleteTransaction } from "@/actions/transactions";
interface TransactionCardProps {
  transaction: {
    id: string;
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amount: number;
    description: string | null;
    date: Date;
    account: {
      id: string;
      name: string;
      currency: string;
      balance: number;
    };
    toAccount: {
      id: string;
      name: string;
    } | null;
    category: {
      id: string;
      name: string;
      color: string;
    } | null;
  };
}

export function TransactionCard({ transaction }: TransactionCardProps) {
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this transaction?")) {
      return;
    }

    setLoading(true);
    await deleteTransaction(transaction.id);
    setLoading(false);
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat("es-PY", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "PYG" ? 0 : 2,
      maximumFractionDigits: currency === "PYG" ? 0 : 2,
    }).format(amount);
  };

  const getIcon = () => {
    switch (transaction.type) {
      case "INCOME":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "EXPENSE":
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case "TRANSFER":
        return <ArrowLeftRight className="h-4 w-4 text-blue-500" />;
    }
  };

  const getAmountColor = () => {
    switch (transaction.type) {
      case "INCOME":
        return "text-green-600";
      case "EXPENSE":
        return "text-red-500";
      case "TRANSFER":
        return "text-blue-500";
    }
  };

  const getAmountPrefix = () => {
    switch (transaction.type) {
      case "INCOME":
        return "+";
      case "EXPENSE":
        return "-";
      case "TRANSFER":
        return "";
    }
  };

  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
              {getIcon()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-sm truncate">
                  {transaction.description || transaction.type}
                </p>
                {transaction.category && (
                  <Badge
                    variant="secondary"
                    className="text-xs shrink-0"
                    style={{
                      backgroundColor: `${transaction.category.color}20`,
                      color: transaction.category.color,
                    }}
                  >
                    {transaction.category.name}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {transaction.type === "TRANSFER"
                  ? `${transaction.account.name} → ${transaction.toAccount?.name}`
                  : transaction.account.name}
                {" · "}
                {format(new Date(transaction.date), "MMM d, yyyy")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <span className={`font-semibold ${getAmountColor()}`}>
              {getAmountPrefix()}
              {formatCurrency(transaction.amount, transaction.account.currency)}
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
