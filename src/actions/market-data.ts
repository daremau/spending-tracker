"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import {
  MarketDataError,
  publicMarketDataError,
} from "@/lib/market-data/errors";
import { getMarketDataProvider } from "@/lib/market-data/provider";
import {
  refreshPortfolioMarketData,
  type MarketRefreshSummary,
} from "@/lib/market-data/refresh";

const searchSchema = z.object({
  query: z.string().trim().min(2, "Enter at least two characters").max(50),
  type: z.enum(["STOCK", "ETF", "CRYPTO"]).optional(),
});

const providerAssetSchema = z.object({
  providerSymbol: z.string().trim().min(1).max(80),
  market: z.string().trim().min(1).max(40),
  type: z.enum(["STOCK", "ETF", "CRYPTO"]),
});

function portfolioEnabled() {
  return process.env.PORTFOLIO_ENABLED === "true";
}

function revalidateMarketData() {
  revalidatePath("/portfolio");
  revalidatePath("/");
  revalidatePath("/accounts");
  revalidatePath("/analytics");
}

export async function searchMarketAssets(query: string, type?: string) {
  if (!portfolioEnabled()) {
    return {
      status: "error" as const,
      message: "Portfolio management is not enabled.",
      results: [],
    };
  }
  const parsed = searchSchema.safeParse({
    query,
    type: type || undefined,
  });
  if (!parsed.success) {
    return {
      status: "invalid" as const,
      message: parsed.error.issues[0]?.message ?? "Invalid search",
      results: [],
    };
  }

  try {
    const results = await getMarketDataProvider().searchAssets(
      parsed.data.query,
      parsed.data.type
    );
    return {
      status: results.length > 0 ? ("ok" as const) : ("empty" as const),
      message:
        results.length > 0
          ? null
          : "No matching supported stocks, ETFs, or crypto pairs were found.",
      results,
    };
  } catch (error) {
    const safe = publicMarketDataError(error);
    return {
      status: safe.code.toLowerCase() as
        | "configuration"
        | "timeout"
        | "quota"
        | "authentication"
        | "invalid_request"
        | "network"
        | "provider",
      message: safe.message,
      results: [],
    };
  }
}

export async function createProviderAsset(formData: FormData) {
  if (!portfolioEnabled()) {
    return { error: "Portfolio management is not enabled." };
  }
  const parsed = providerAssetSchema.safeParse({
    providerSymbol: formData.get("providerSymbol"),
    market: formData.get("market"),
    type: formData.get("type"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid provider asset",
    };
  }

  try {
    const results = await getMarketDataProvider().searchAssets(
      parsed.data.providerSymbol,
      parsed.data.type
    );
    const selected = results.find(
      (result) =>
        result.providerSymbol === parsed.data.providerSymbol &&
        result.market === parsed.data.market.toUpperCase() &&
        result.type === parsed.data.type
    );
    if (!selected) {
      return {
        error:
          "That provider result is no longer available. Search again or add it manually.",
      };
    }

    const asset = await prismaAssetTransaction(selected);
    revalidateMarketData();
    return { success: true as const, id: asset.id, reused: asset.reused };
  } catch (error) {
    const safe = publicMarketDataError(error);
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "That asset already exists." };
    }
    return { error: safe.message };
  }
}

async function prismaAssetTransaction(selected: {
  providerSymbol: string;
  symbol: string;
  name: string;
  market: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  quoteCurrency: string;
}) {
  return prisma.$transaction(async (tx) => {
    const providerAsset = await tx.asset.findFirst({
      where: {
        provider: "TWELVE_DATA",
        providerSymbol: selected.providerSymbol,
      },
    });
    if (providerAsset) return { ...providerAsset, reused: true };

    const identity = await tx.asset.findUnique({
      where: {
        type_symbol_market: {
          type: selected.type,
          symbol: selected.symbol,
          market: selected.market,
        },
      },
    });
    if (identity) {
      if (
        identity.provider &&
        (identity.provider !== "TWELVE_DATA" ||
          identity.providerSymbol !== selected.providerSymbol)
      ) {
        throw new MarketDataError(
          "INVALID_REQUEST",
          "That asset identity is linked to another provider."
        );
      }
      const updated = await tx.asset.update({
        where: { id: identity.id },
        data: {
          name: selected.name,
          quoteCurrency: selected.quoteCurrency,
          provider: "TWELVE_DATA",
          providerSymbol: selected.providerSymbol,
          active: true,
        },
      });
      return { ...updated, reused: true };
    }

    const created = await tx.asset.create({
      data: {
        type: selected.type,
        symbol: selected.symbol,
        name: selected.name,
        market: selected.market,
        quoteCurrency: selected.quoteCurrency,
        provider: "TWELVE_DATA",
        providerSymbol: selected.providerSymbol,
      },
    });
    return { ...created, reused: false };
  });
}

export async function refreshPortfolioQuotes(): Promise<
  { success: true; summary: MarketRefreshSummary } | { error: string }
> {
  if (!portfolioEnabled()) {
    return { error: "Portfolio management is not enabled." };
  }
  try {
    const summary = await refreshPortfolioMarketData();
    revalidateMarketData();
    return { success: true, summary };
  } catch {
    return {
      error: "Market data could not be refreshed. Cached values were kept.",
    };
  }
}
