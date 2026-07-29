import { describe, expect, it } from "vitest";
import { replayLedger } from "./calculations";

const date = "2026-01-01T00:00:00.000Z";

function transaction(
  overrides: Partial<Parameters<typeof replayLedger>[0][number]>
) {
  return {
    id: "tx",
    type: "OPENING_POSITION" as const,
    quantity: "1",
    unitPrice: "100",
    fees: "0",
    fxRateToReporting: "1",
    date,
    createdAt: date,
    ...overrides,
  };
}

describe("portfolio ledger replay", () => {
  it("retains fractional opening-position precision without changing cash", () => {
    const state = replayLedger([
      transaction({
        quantity: "0.123456789012",
        unitPrice: "60000.12345678",
        fxRateToReporting: "7500",
      }),
    ]);

    expect(state.quantity).toBe("0.123456789012");
    expect(state.remainingCostNative).toBe("7407.42258229764056090136");
    expect(state.remainingCostReporting).toBe("55555669.3672323042067602");
    expect(state.cashEffect).toBe("0");
  });

  it("calculates weighted-average buys", () => {
    const state = replayLedger([
      transaction({ id: "buy-1", type: "BUY", quantity: "10", unitPrice: "100", fees: "5" }),
      transaction({ id: "buy-2", type: "BUY", quantity: "5", unitPrice: "120", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(state.quantity).toBe("15");
    expect(state.remainingCostNative).toBe("1605");
    expect(state.averageCostNative).toBe("107");
    expect(state.cashEffect).toBe("-1605");
  });

  it("allocates weighted-average cost on a partial sale", () => {
    const state = replayLedger([
      transaction({ id: "buy-1", type: "BUY", quantity: "10", unitPrice: "100", fees: "5" }),
      transaction({ id: "buy-2", type: "BUY", quantity: "5", unitPrice: "120", createdAt: "2026-01-02T00:00:00.000Z" }),
      transaction({ id: "sell", type: "SELL", quantity: "6", unitPrice: "130", fees: "2", createdAt: "2026-01-03T00:00:00.000Z" }),
    ]);

    expect(state.quantity).toBe("9");
    expect(state.remainingCostNative).toBe("963");
    expect(state.realizedGainNative).toBe("136");
    expect(state.cashEffect).toBe("-827");
  });

  it("forces cost to exact zero after a full sale", () => {
    const state = replayLedger([
      transaction({ id: "buy", type: "BUY", quantity: "3", unitPrice: "1.11111111" }),
      transaction({ id: "sell", type: "SELL", quantity: "3", unitPrice: "2", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(state.quantity).toBe("0");
    expect(state.remainingCostNative).toBe("0");
    expect(state.remainingCostReporting).toBe("0");
  });

  it("rejects an oversell and a backdated invalidation", () => {
    expect(() =>
      replayLedger([
        transaction({ id: "buy", type: "BUY", quantity: "10" }),
        transaction({ id: "sell-early", type: "SELL", quantity: "5", date: "2026-01-15T00:00:00.000Z" }),
        transaction({ id: "sell-late", type: "SELL", quantity: "8", date: "2026-02-01T00:00:00.000Z" }),
      ])
    ).toThrow("only 5 is available");
  });

  it("captures reporting-currency movement in realized results", () => {
    const state = replayLedger([
      transaction({ id: "buy", type: "BUY", fxRateToReporting: "7000" }),
      transaction({ id: "sell", type: "SELL", fxRateToReporting: "7500", createdAt: "2026-01-02T00:00:00.000Z" }),
    ]);

    expect(state.realizedGainNative).toBe("0");
    expect(state.realizedGainReporting).toBe("50000");
  });
});
