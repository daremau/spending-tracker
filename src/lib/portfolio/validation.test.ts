import { describe, expect, it } from "vitest";
import {
  investmentActivitySchema,
  manualAssetSchema,
  openingPositionSchema,
  portfolioTransferSchema,
} from "./validation";

describe("manual portfolio validation", () => {
  it("normalizes stock identity", () => {
    expect(
      manualAssetSchema.parse({
        type: "STOCK",
        symbol: "aapl",
        name: "Apple",
        market: "nasdaq",
        quoteCurrency: "usd",
      })
    ).toMatchObject({ symbol: "AAPL", market: "NASDAQ", quoteCurrency: "USD" });
  });

  it("retains a crypto pair symbol", () => {
    expect(
      manualAssetSchema.parse({
        type: "CRYPTO",
        symbol: "btc/usd",
        name: "Bitcoin",
        market: "crypto",
        quoteCurrency: "USD",
      }).symbol
    ).toBe("BTC/USD");
  });

  it("accepts twelve quantity decimals and rejects a thirteenth", () => {
    const base = {
      clientRequestId: "8e702b4e-7cf2-44de-b19e-855f614dc450",
      accountId: "account",
      assetId: "asset",
      unitPrice: "60000.12345678",
      fees: "0",
      fxRateToReporting: "7500",
      date: "2026-01-01",
    };

    expect(
      openingPositionSchema.safeParse({
        ...base,
        quantity: "0.123456789012",
      }).success
    ).toBe(true);
    expect(
      openingPositionSchema.safeParse({
        ...base,
        quantity: "0.1234567890123",
      }).success
    ).toBe(false);
  });
});

describe("Sprint 3 portfolio validation", () => {
  const baseActivity = {
    clientRequestId: "28c70bb6-69f6-4a45-b1f8-96e13b3db6cf",
    accountId: "account",
    assetId: "asset",
    type: "BUY" as const,
    quantity: "10",
    unitPrice: "100",
    cashAmount: "",
    fees: "5",
    fxRateToReporting: "1",
    date: "2026-07-29",
    notes: "",
  };

  it("accepts valid buys, dividends, and account fees", () => {
    expect(investmentActivitySchema.safeParse(baseActivity).success).toBe(true);
    expect(
      investmentActivitySchema.safeParse({
        ...baseActivity,
        type: "DIVIDEND",
        quantity: "",
        unitPrice: "",
        cashAmount: "20",
      }).success
    ).toBe(true);
    expect(
      investmentActivitySchema.safeParse({
        ...baseActivity,
        type: "FEE",
        assetId: "",
        quantity: "",
        unitPrice: "",
        cashAmount: "3",
        fees: "0",
      }).success
    ).toBe(true);
  });

  it("rejects missing trade fields and non-positive cash activity", () => {
    expect(
      investmentActivitySchema.safeParse({
        ...baseActivity,
        quantity: "",
      }).success
    ).toBe(false);
    expect(
      investmentActivitySchema.safeParse({
        ...baseActivity,
        type: "DIVIDEND",
        quantity: "",
        unitPrice: "",
        cashAmount: "0",
      }).success
    ).toBe(false);
  });

  it("limits funding transfers to positive two-decimal amounts", () => {
    const transfer = {
      clientRequestId: "31423b38-140e-4b3f-bd6d-c57ef85eab2d",
      accountId: "investment",
      bankAccountId: "bank",
      direction: "FUND",
      amount: "100.25",
      date: "2026-07-29",
      notes: "",
    };
    expect(portfolioTransferSchema.safeParse(transfer).success).toBe(true);
    expect(
      portfolioTransferSchema.safeParse({ ...transfer, amount: "100.251" })
        .success
    ).toBe(false);
  });
});
