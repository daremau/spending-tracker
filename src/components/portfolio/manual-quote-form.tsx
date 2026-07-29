"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DollarSign, Trash2 } from "lucide-react";
import {
  deactivateManualQuote,
  upsertManualQuote,
} from "@/actions/portfolio";
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
import type { PortfolioAssetDto } from "@/lib/portfolio/dtos";

export function ManualQuoteForm({
  asset,
  currentPrice,
  manualQuoteId,
}: {
  asset: PortfolioAssetDto;
  currentPrice?: string | null;
  manualQuoteId?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = await upsertManualQuote(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleDeactivate() {
    if (!manualQuoteId) return;
    setPending(true);
    const result = await deactivateManualQuote(manualQuoteId);
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
          <DollarSign />
          Price
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual price for {asset.symbol}</DialogTitle>
          <DialogDescription>
            This value takes priority over cached provider quotes.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input type="hidden" name="assetId" value={asset.id} />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`manual-price-${asset.id}`}>
              Price ({asset.quoteCurrency})
            </Label>
            <Input
              id={`manual-price-${asset.id}`}
              name="price"
              inputMode="decimal"
              defaultValue={currentPrice ?? ""}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`manual-price-date-${asset.id}`}>As of</Label>
            <Input
              id={`manual-price-date-${asset.id}`}
              name="asOf"
              type="datetime-local"
              defaultValue={new Date().toISOString().slice(0, 16)}
              required
            />
          </div>
          <div className="flex gap-2">
            {manualQuoteId && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDeactivate}
                disabled={pending}
              >
                <Trash2 />
                Deactivate
              </Button>
            )}
            <Button className="flex-1" disabled={pending}>
              {pending ? "Saving..." : "Save price"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
