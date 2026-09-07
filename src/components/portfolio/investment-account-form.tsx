"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createInvestmentAccount } from "@/actions/portfolio";
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

export function InvestmentAccountForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createInvestmentAccount(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus />
          Add account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add investment account</DialogTitle>
          <DialogDescription>
            Create a brokerage, exchange, or wallet with its own linked cash
            balance.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="investment-name">Name</Label>
            <Input
              id="investment-name"
              name="name"
              placeholder="My Broker"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="investment-type">Account type</Label>
            <Select name="type" defaultValue="BROKERAGE" required>
              <SelectTrigger id="investment-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BROKERAGE">Brokerage</SelectItem>
                <SelectItem value="EXCHANGE">Exchange</SelectItem>
                <SelectItem value="WALLET">Wallet</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cash-currency">Cash currency</Label>
            <Input
              id="cash-currency"
              name="cashCurrency"
              defaultValue="USD"
              maxLength={3}
              className="uppercase"
              required
            />
          </div>
          <Button className="w-full" disabled={pending}>
            {pending ? "Creating..." : "Create account"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
