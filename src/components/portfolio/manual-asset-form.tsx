"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createManualAsset } from "@/actions/portfolio";
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

export function ManualAssetForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await createManualAsset(formData);
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
        <Button variant="outline" size="sm">
          <Plus />
          Add asset
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add asset manually</DialogTitle>
          <DialogDescription>
            Define a stock, ETF, or crypto pair without using a market-data
            provider.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor="asset-type">Asset type</Label>
            <Select name="type" defaultValue="STOCK" required>
              <SelectTrigger id="asset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STOCK">Stock</SelectItem>
                <SelectItem value="ETF">ETF</SelectItem>
                <SelectItem value="CRYPTO">Crypto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="asset-symbol">Symbol</Label>
              <Input
                id="asset-symbol"
                name="symbol"
                placeholder="AAPL or BTC/USD"
                className="uppercase"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="asset-market">Market</Label>
              <Input
                id="asset-market"
                name="market"
                placeholder="NASDAQ or CRYPTO"
                className="uppercase"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="asset-name">Display name</Label>
            <Input id="asset-name" name="name" placeholder="Apple Inc." required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quote-currency">Quote currency</Label>
            <Input
              id="quote-currency"
              name="quoteCurrency"
              defaultValue="USD"
              maxLength={3}
              className="uppercase"
              required
            />
          </div>
          <Button className="w-full" disabled={pending}>
            {pending ? "Saving..." : "Save asset"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
