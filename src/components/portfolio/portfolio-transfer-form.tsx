"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, WalletCards } from "lucide-react";
import { createPortfolioTransfer } from "@/actions/portfolio";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  PortfolioAccountOptionDto,
  StandardBankAccountOptionDto,
} from "@/lib/portfolio/dtos";

function formatBalance(value: string, currency: string) {
  return new Intl.NumberFormat("es-PY", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "PYG" ? 0 : 2,
  }).format(Number(value));
}

export function PortfolioTransferForm({
  account,
  bankAccounts,
}: {
  account: PortfolioAccountOptionDto;
  bankAccounts: StandardBankAccountOptionDto[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState("");
  const [direction, setDirection] = useState<"FUND" | "WITHDRAW">("FUND");

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) setRequestId(crypto.randomUUID());
    setError(null);
    setOpen(nextOpen);
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createPortfolioTransfer(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <WalletCards />
          Move cash
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move investment cash</DialogTitle>
          <DialogDescription>
            Funding and withdrawals are transfers. They do not count as income
            or spending.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input
            type="hidden"
            name="clientRequestId"
            value={requestId}
            readOnly
          />
          <input type="hidden" name="accountId" value={account.id} readOnly />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`transfer-direction-${account.id}`}>Direction</Label>
            <Select
              name="direction"
              value={direction}
              onValueChange={(value: "FUND" | "WITHDRAW") =>
                setDirection(value)
              }
            >
              <SelectTrigger id={`transfer-direction-${account.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FUND">
                  Fund investment cash
                </SelectItem>
                <SelectItem value="WITHDRAW">
                  Withdraw to bank
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`transfer-bank-${account.id}`}>
              {direction === "FUND" ? "From bank account" : "To bank account"}
            </Label>
            <Select name="bankAccountId" required>
              <SelectTrigger id={`transfer-bank-${account.id}`}>
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map((bankAccount) => (
                  <SelectItem key={bankAccount.id} value={bankAccount.id}>
                    {bankAccount.name} ·{" "}
                    {formatBalance(bankAccount.balance, bankAccount.currency)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {bankAccounts.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Create a standard {account.cashCurrency} account before moving
                cash.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`transfer-amount-${account.id}`}>
                Amount ({account.cashCurrency})
              </Label>
              <Input
                id={`transfer-amount-${account.id}`}
                name="amount"
                inputMode="decimal"
                placeholder="1000.00"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`transfer-date-${account.id}`}>Date</Label>
              <Input
                id={`transfer-date-${account.id}`}
                name="date"
                type="date"
                defaultValue={new Date().toISOString().slice(0, 10)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`transfer-notes-${account.id}`}>Notes</Label>
            <Input
              id={`transfer-notes-${account.id}`}
              name="notes"
              maxLength={500}
              placeholder="Optional"
            />
          </div>
          <Button
            className="w-full"
            disabled={pending || bankAccounts.length === 0}
          >
            {direction === "FUND" ? <ArrowDownToLine /> : <ArrowUpFromLine />}
            {pending
              ? "Saving..."
              : direction === "FUND"
                ? "Fund account"
                : "Withdraw cash"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
