"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createOpeningPosition,
  deleteOpeningPosition,
  updateOpeningPosition,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  InvestmentActivityDto,
  PortfolioAccountOptionDto,
  PortfolioAssetDto,
} from "@/lib/portfolio/dtos";

export function OpeningPositionForm({
  accounts,
  assets,
  defaultAccountId,
  activity,
}: {
  accounts: PortfolioAccountOptionDto[];
  assets: PortfolioAssetDto[];
  defaultAccountId?: string;
  activity?: InvestmentActivityDto;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const initialAccountId = activity ? defaultAccountId : defaultAccountId ?? accounts[0]?.id;
  const [accountId, setAccountId] = useState(initialAccountId ?? "");
  const [requestId, setRequestId] = useState(activity?.clientRequestId ?? "");

  const selectedAccount = accounts.find((account) => account.id === accountId);
  const eligibleAssets = useMemo(
    () =>
      selectedAccount
        ? assets.filter(
            (asset) => asset.quoteCurrency === selectedAccount.cashCurrency
          )
        : assets,
    [assets, selectedAccount]
  );

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !activity) {
      setRequestId(crypto.randomUUID());
    }
    setError(null);
    setOpen(nextOpen);
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = activity
      ? await updateOpeningPosition(activity.id, formData)
      : await createOpeningPosition(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!activity || !confirm("Delete this opening position?")) return;
    setPending(true);
    const result = await deleteOpeningPosition(activity.id);
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
        <Button variant={activity ? "ghost" : "default"} size="sm">
          {activity ? <Pencil /> : <Plus />}
          {activity ? "Edit" : "Opening position"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {activity ? "Edit opening position" : "Add opening position"}
          </DialogTitle>
          <DialogDescription>
            This establishes quantity and cost without changing investment
            cash.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <input
            type="hidden"
            name="clientRequestId"
            value={requestId}
            readOnly
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="space-y-2">
            <Label htmlFor={`opening-account-${activity?.id ?? "new"}`}>
              Account
            </Label>
            <Select
              name="accountId"
              value={accountId}
              onValueChange={setAccountId}
              disabled={Boolean(activity)}
              required
            >
              <SelectTrigger id={`opening-account-${activity?.id ?? "new"}`}>
                <SelectValue placeholder="Choose account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name} ({account.cashCurrency})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activity && (
              <input type="hidden" name="accountId" value={accountId} />
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`opening-asset-${activity?.id ?? "new"}`}>Asset</Label>
            <Select
              name="assetId"
              defaultValue={activity?.assetId ?? undefined}
              disabled={Boolean(activity)}
              required
            >
              <SelectTrigger id={`opening-asset-${activity?.id ?? "new"}`}>
                <SelectValue placeholder="Choose asset" />
              </SelectTrigger>
              <SelectContent>
                {eligibleAssets.map((asset) => (
                  <SelectItem key={asset.id} value={asset.id}>
                    {asset.symbol} · {asset.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activity?.assetId && (
              <input type="hidden" name="assetId" value={activity.assetId} />
            )}
            {eligibleAssets.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Add an asset quoted in this account&apos;s cash currency first.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`opening-quantity-${activity?.id ?? "new"}`}>
                Quantity
              </Label>
              <Input
                id={`opening-quantity-${activity?.id ?? "new"}`}
                name="quantity"
                inputMode="decimal"
                defaultValue={activity?.quantity ?? ""}
                placeholder="10"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`opening-price-${activity?.id ?? "new"}`}>
                Unit cost
              </Label>
              <Input
                id={`opening-price-${activity?.id ?? "new"}`}
                name="unitPrice"
                inputMode="decimal"
                defaultValue={activity?.unitPrice ?? ""}
                placeholder="100"
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`opening-fees-${activity?.id ?? "new"}`}>Fees</Label>
              <Input
                id={`opening-fees-${activity?.id ?? "new"}`}
                name="fees"
                inputMode="decimal"
                defaultValue={activity?.fees ?? "0"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`opening-fx-${activity?.id ?? "new"}`}>
                FX to reporting
              </Label>
              <Input
                id={`opening-fx-${activity?.id ?? "new"}`}
                name="fxRateToReporting"
                inputMode="decimal"
                defaultValue={activity?.fxRateToReporting ?? "1"}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`opening-date-${activity?.id ?? "new"}`}>Date</Label>
            <Input
              id={`opening-date-${activity?.id ?? "new"}`}
              name="date"
              type="date"
              defaultValue={
                activity?.date.slice(0, 10) ??
                new Date().toISOString().slice(0, 10)
              }
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`opening-notes-${activity?.id ?? "new"}`}>Notes</Label>
            <Input
              id={`opening-notes-${activity?.id ?? "new"}`}
              name="notes"
              defaultValue={activity?.notes ?? ""}
              maxLength={500}
            />
          </div>
          <div className="flex gap-2">
            {activity && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={pending}
              >
                <Trash2 />
                Delete
              </Button>
            )}
            <Button
              className="flex-1"
              disabled={pending || eligibleAssets.length === 0}
            >
              {pending ? "Saving..." : "Save position"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
