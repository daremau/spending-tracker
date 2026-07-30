"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  createProviderAsset,
  searchMarketAssets,
} from "@/actions/market-data";
import { Badge } from "@/components/ui/badge";
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
import type { AssetSearchResult, MarketAssetType } from "@/lib/market-data/types";

export function AssetSearch() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<MarketAssetType | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AssetSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  function scheduleSearch(nextQuery: string, nextType = type) {
    setQuery(nextQuery);
    if (timerRef.current) clearTimeout(timerRef.current);
    const normalized = nextQuery.trim();
    if (normalized.length < 2) {
      setSearching(false);
      setResults([]);
      setMessage(
        normalized.length === 0 ? null : "Enter at least two characters."
      );
      return;
    }

    const request = requestRef.current + 1;
    requestRef.current = request;
    setSearching(true);
    setMessage(null);
    timerRef.current = setTimeout(async () => {
      const response = await searchMarketAssets(
        normalized,
        nextType === "ALL" ? undefined : nextType
      );
      if (request !== requestRef.current) return;
      setSearching(false);
      setResults(response.results);
      setMessage(response.message);
    }, 350);
  }

  async function saveAsset(result: AssetSearchResult) {
    setSaving(`${result.providerSymbol}:${result.market}`);
    setMessage(null);
    const formData = new FormData();
    formData.set("providerSymbol", result.providerSymbol);
    formData.set("market", result.market);
    formData.set("type", result.type);
    const response = await createProviderAsset(formData);
    setSaving(null);
    if (response.error) {
      setMessage(response.error);
      return;
    }
    setMessage(response.reused ? "Asset already available." : "Asset added.");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Search />
          Search assets
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Search market assets</DialogTitle>
          <DialogDescription>
            Search supported stocks, ETFs, and crypto pairs. Provider data is
            requested only from the server.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="provider-asset-type">Type</Label>
            <Select
              value={type}
              onValueChange={(value: MarketAssetType | "ALL") => {
                setType(value);
                scheduleSearch(query, value);
              }}
            >
              <SelectTrigger id="provider-asset-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All supported</SelectItem>
                <SelectItem value="STOCK">Stocks</SelectItem>
                <SelectItem value="ETF">ETFs</SelectItem>
                <SelectItem value="CRYPTO">Crypto</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="provider-asset-query">Symbol or name</Label>
            <Input
              id="provider-asset-query"
              value={query}
              onChange={(event) => scheduleSearch(event.target.value)}
              placeholder="AAPL, SPY, or BTC/USD"
              autoComplete="off"
            />
          </div>
        </div>
        <div aria-live="polite">
          {searching && (
            <p className="text-sm text-muted-foreground">Searching...</p>
          )}
          {!searching && message && (
            <p className="text-sm text-muted-foreground">{message}</p>
          )}
        </div>
        {results.length > 0 && (
          <div className="divide-y rounded-md border">
            {results.map((result) => {
              const key = `${result.providerSymbol}:${result.market}`;
              return (
                <div
                  key={key}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium">{result.providerSymbol}</p>
                      <Badge variant="secondary">{result.type}</Badge>
                      <Badge variant="outline">{result.market}</Badge>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">
                      {result.name} · {result.quoteCurrency}
                      {result.country ? ` · ${result.country}` : ""}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => saveAsset(result)}
                    disabled={saving === key}
                  >
                    {saving === key ? "Adding..." : "Add"}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          No match or provider unavailable? Close this dialog and use Add
          manually.
        </p>
      </DialogContent>
    </Dialog>
  );
}
