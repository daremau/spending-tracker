"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshPortfolioQuotes } from "@/actions/market-data";
import { Button } from "@/components/ui/button";

export function RefreshMarketDataButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleRefresh() {
    setPending(true);
    setMessage(null);
    const result = await refreshPortfolioQuotes();
    setPending(false);
    if ("error" in result) {
      setMessage(result.error);
      return;
    }

    const updated =
      result.summary.quotes.updated + result.summary.rates.updated;
    const failures = result.summary.failures.length;
    const firstFailure = result.summary.failures[0]?.message;
    setMessage(
      failures > 0
        ? `${updated} value${updated === 1 ? "" : "s"} updated; ${failures} could not be refreshed. ${firstFailure ?? "Cached values were kept."}`
        : updated > 0
          ? `${updated} market value${updated === 1 ? "" : "s"} updated.`
          : "All available market values are already current or manual."
    );
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleRefresh}
        disabled={pending}
      >
        <RefreshCw className={pending ? "animate-spin" : ""} />
        {pending ? "Refreshing..." : "Refresh prices"}
      </Button>
      {message && (
        <p className="max-w-xs text-right text-xs text-muted-foreground" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
