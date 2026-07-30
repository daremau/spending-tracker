"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Settings, Trash2 } from "lucide-react";
import {
  deactivateManualExchangeRate,
  updateReportingCurrency,
  upsertManualExchangeRate,
} from "@/actions/settings";
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
import { Separator } from "@/components/ui/separator";

export type CurrencyConfiguration = {
  reportingCurrency: string;
  timezone: string;
  rates: Array<{
    id: string;
    fromCurrency: string;
    toCurrency: string;
    rate: string;
    source: "MANUAL" | "TWELVE_DATA";
    active: boolean;
    asOf: string;
    fetchedAt: string;
    freshness: "MANUAL" | "FRESH" | "STALE";
  }>;
};

type ActionResult = { success?: true; error?: string };

export function CurrencySettingsDialog({
  configuration,
}: {
  configuration: CurrencyConfiguration;
}) {
  const router = useRouter();
  const rateFormRef = useRef<HTMLFormElement>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [rateMessage, setRateMessage] = useState<string | null>(null);

  const activeRates = configuration.rates.filter((rate) => rate.active);

  async function runAction(
    key: string,
    action: () => Promise<ActionResult>,
    setMessage: (message: string | null) => void,
    successMessage: string
  ) {
    setPendingAction(key);
    setMessage(null);
    const result = await action();
    setPendingAction(null);

    if (result.error) {
      setMessage(result.error);
      return false;
    }

    setMessage(successMessage);
    router.refresh();
    return true;
  }

  async function handleReportingCurrency(formData: FormData) {
    await runAction(
      "reporting-currency",
      () => updateReportingCurrency(formData),
      setSettingsMessage,
      "Reporting currency updated."
    );
  }

  async function handleExchangeRate(formData: FormData) {
    const saved = await runAction(
      "exchange-rate",
      () => upsertManualExchangeRate(formData),
      setRateMessage,
      "Exchange rate saved."
    );
    if (saved) {
      rateFormRef.current?.reset();
    }
  }

  async function handleDeactivate(id: string) {
    await runAction(
      `deactivate-${id}`,
      () => deactivateManualExchangeRate(id),
      setRateMessage,
      "Exchange rate deactivated."
    );
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Settings className="h-4 w-4" />
          <span className="hidden sm:inline">Settings</span>
          <span className="sr-only sm:hidden">Currency settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Currency settings</DialogTitle>
          <DialogDescription>
            Choose the currency for totals and add directional exchange rates.
          </DialogDescription>
        </DialogHeader>

        <form action={handleReportingCurrency} className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="reportingCurrency">Reporting currency</Label>
            <div className="flex gap-2">
              <Input
                key={configuration.reportingCurrency}
                id="reportingCurrency"
                name="reportingCurrency"
                defaultValue={configuration.reportingCurrency}
                maxLength={3}
                className="uppercase"
                aria-describedby="reporting-currency-help"
                required
              />
              <Button
                type="submit"
                disabled={pendingAction === "reporting-currency"}
              >
                {pendingAction === "reporting-currency" ? "Saving..." : "Save"}
              </Button>
            </div>
            <p
              id="reporting-currency-help"
              className="text-xs text-muted-foreground"
            >
              Use a three-letter code such as PYG, USD, or EUR.
            </p>
          </div>
          {settingsMessage && (
            <p className="text-sm" role="status">
              {settingsMessage}
            </p>
          )}
        </form>

        <Separator />

        <form
          ref={rateFormRef}
          action={handleExchangeRate}
          className="space-y-3"
        >
          <div>
            <h3 className="font-medium">Manual exchange rate</h3>
            <p className="text-xs text-muted-foreground">
              Enter the exact direction shown. Rates are never inverted
              automatically.
            </p>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <div className="space-y-2">
              <Label htmlFor="fromCurrency">From</Label>
              <Input
                id="fromCurrency"
                name="fromCurrency"
                defaultValue="USD"
                maxLength={3}
                className="uppercase"
                required
              />
            </div>
            <span className="pb-2 text-muted-foreground">→</span>
            <div className="space-y-2">
              <Label htmlFor="toCurrency">To</Label>
              <Input
                id="toCurrency"
                name="toCurrency"
                defaultValue={configuration.reportingCurrency}
                maxLength={3}
                className="uppercase"
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rate">Rate</Label>
            <Input
              id="rate"
              name="rate"
              inputMode="decimal"
              placeholder="7500"
              required
            />
            <p className="text-xs text-muted-foreground">
              Example: 1 USD = 7,500 PYG is entered as USD → PYG with rate
              7500.
            </p>
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={pendingAction === "exchange-rate"}
          >
            {pendingAction === "exchange-rate" ? "Saving..." : "Save rate"}
          </Button>
          {rateMessage && (
            <p className="text-sm" role="status">
              {rateMessage}
            </p>
          )}
        </form>

        <Separator />

        <div className="space-y-3">
          <h3 className="font-medium">Active exchange rates</h3>
          {activeRates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No exchange rates yet.
            </p>
          ) : (
            <div className="space-y-2">
              {activeRates.map((rate) => (
                <div
                  key={rate.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      1 {rate.fromCurrency} = {rate.rate} {rate.toCurrency}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {rate.source === "MANUAL"
                        ? "Manual rate"
                        : `${rate.freshness === "FRESH" ? "Fresh" : "Stale"} automatic rate · ${new Intl.DateTimeFormat(
                            "es-PY",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                            }
                          ).format(new Date(rate.asOf))}`}
                    </p>
                  </div>
                  {rate.source === "MANUAL" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeactivate(rate.id)}
                      disabled={pendingAction === `deactivate-${rate.id}`}
                      aria-label={`Deactivate ${rate.fromCurrency} to ${rate.toCurrency} rate`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
