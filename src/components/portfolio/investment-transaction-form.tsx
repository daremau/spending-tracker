"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  createInvestmentActivity,
  deleteInvestmentActivity,
  updateInvestmentActivity,
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

type ActivityType = "BUY" | "SELL" | "DIVIDEND" | "FEE";

const activityLabels: Record<ActivityType, string> = {
  BUY: "Buy",
  SELL: "Sell",
  DIVIDEND: "Dividend",
  FEE: "Fee",
};

export function InvestmentTransactionForm({
  account,
  assets,
  activity,
}: {
  account: PortfolioAccountOptionDto;
  assets: PortfolioAssetDto[];
  activity?: InvestmentActivityDto;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestId, setRequestId] = useState(activity?.clientRequestId ?? "");
  const [type, setType] = useState<ActivityType>(
    activity && activity.type !== "OPENING_POSITION" ? activity.type : "BUY"
  );
  const [assetId, setAssetId] = useState(
    activity?.assetId ??
      assets.find((asset) => asset.quoteCurrency === account.cashCurrency)?.id ??
      ""
  );
  const eligibleAssets = useMemo(
    () =>
      assets.filter((asset) => asset.quoteCurrency === account.cashCurrency),
    [account.cashCurrency, assets]
  );
  const trade = type === "BUY" || type === "SELL";
  const cashActivity = type === "DIVIDEND" || type === "FEE";

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen && !activity) setRequestId(crypto.randomUUID());
    setError(null);
    setOpen(nextOpen);
  }

  async function handleSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const result = activity
      ? await updateInvestmentActivity(activity.id, formData)
      : await createInvestmentActivity(formData);
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!activity || !confirm(`Delete this ${activityLabels[type].toLowerCase()}?`)) {
      return;
    }
    setPending(true);
    setError(null);
    const result = await deleteInvestmentActivity(activity.id);
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
          {activity ? "Edit" : "Record activity"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {activity
              ? `Edit ${activityLabels[type].toLowerCase()}`
              : "Record investment activity"}
          </DialogTitle>
          <DialogDescription>
            Cash and position changes are saved together after validating the
            complete asset history.
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
          <input
            type="hidden"
            name="assetId"
            value={assetId === "__account__" ? "" : assetId}
            readOnly
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`activity-type-${activity?.id ?? "new"}`}>
                Activity
              </Label>
              <Select
                name="type"
                value={type}
                onValueChange={(value: ActivityType) => {
                  setType(value);
                  if (
                    value !== "FEE" &&
                    (assetId === "__account__" || !assetId)
                  ) {
                    setAssetId(eligibleAssets[0]?.id ?? "");
                  }
                }}
                disabled={Boolean(activity)}
              >
                <SelectTrigger
                  id={`activity-type-${activity?.id ?? "new"}`}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(activityLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {activity && <input type="hidden" name="type" value={type} />}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`activity-asset-${activity?.id ?? "new"}`}>
                Asset
              </Label>
              <Select
                value={assetId}
                onValueChange={setAssetId}
                disabled={Boolean(activity)}
              >
                <SelectTrigger
                  id={`activity-asset-${activity?.id ?? "new"}`}
                >
                  <SelectValue
                    placeholder={
                      type === "FEE" ? "Account-level fee" : "Choose asset"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {type === "FEE" && (
                    <SelectItem value="__account__">
                      Account-level fee
                    </SelectItem>
                  )}
                  {eligibleAssets.map((asset) => (
                    <SelectItem key={asset.id} value={asset.id}>
                      {asset.symbol} · {asset.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {trade && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor={`activity-quantity-${activity?.id ?? "new"}`}>
                  Quantity
                </Label>
                <Input
                  id={`activity-quantity-${activity?.id ?? "new"}`}
                  name="quantity"
                  inputMode="decimal"
                  defaultValue={activity?.quantity ?? ""}
                  placeholder="10"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`activity-price-${activity?.id ?? "new"}`}>
                  Unit price ({account.cashCurrency})
                </Label>
                <Input
                  id={`activity-price-${activity?.id ?? "new"}`}
                  name="unitPrice"
                  inputMode="decimal"
                  defaultValue={activity?.unitPrice ?? ""}
                  placeholder="100"
                  required
                />
              </div>
            </div>
          )}

          {cashActivity && (
            <div className="space-y-2">
              <Label htmlFor={`activity-cash-${activity?.id ?? "new"}`}>
                {type === "DIVIDEND" ? "Gross dividend" : "Fee amount"} (
                {account.cashCurrency})
              </Label>
              <Input
                id={`activity-cash-${activity?.id ?? "new"}`}
                name="cashAmount"
                inputMode="decimal"
                defaultValue={activity?.cashAmount ?? ""}
                placeholder="20"
                required
              />
            </div>
          )}

          {type !== "FEE" && (
            <div className="space-y-2">
              <Label htmlFor={`activity-fees-${activity?.id ?? "new"}`}>
                Fees ({account.cashCurrency})
              </Label>
              <Input
                id={`activity-fees-${activity?.id ?? "new"}`}
                name="fees"
                inputMode="decimal"
                defaultValue={activity?.fees ?? "0"}
                required
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor={`activity-fx-${activity?.id ?? "new"}`}>
                FX to reporting
              </Label>
              <Input
                id={`activity-fx-${activity?.id ?? "new"}`}
                name="fxRateToReporting"
                inputMode="decimal"
                defaultValue={activity?.fxRateToReporting ?? "1"}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor={`activity-date-${activity?.id ?? "new"}`}>
                Date
              </Label>
              <Input
                id={`activity-date-${activity?.id ?? "new"}`}
                name="date"
                type="date"
                defaultValue={
                  activity?.date.slice(0, 10) ??
                  new Date().toISOString().slice(0, 10)
                }
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`activity-notes-${activity?.id ?? "new"}`}>
              Notes
            </Label>
            <Input
              id={`activity-notes-${activity?.id ?? "new"}`}
              name="notes"
              defaultValue={activity?.notes ?? ""}
              maxLength={500}
              placeholder="Optional"
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
              disabled={
                pending ||
                (type !== "FEE" && eligibleAssets.length === 0) ||
                (type !== "FEE" &&
                  (!assetId || assetId === "__account__"))
              }
            >
              {pending ? "Saving..." : `Save ${activityLabels[type].toLowerCase()}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
