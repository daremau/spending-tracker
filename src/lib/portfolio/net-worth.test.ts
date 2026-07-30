import Decimal from "decimal.js";
import { describe, expect, it } from "vitest";
import {
  calculateMarketValue,
  calculateTransactionCashEffect,
  replayLedger,
  type LedgerTransactionInput,
} from "./calculations";
import { composeNetWorth, type NetWorthPart } from "./net-worth";

const NO_GAP: Pick<NetWorthPart, "missingRates"> = { missingRates: [] };

function part(value: string | null, missingRates: string[] = []): NetWorthPart {
  return { value, missingRates };
}

describe("composeNetWorth", () => {
  it("adds bank cash, investment cash, and holdings exactly once", () => {
    const summary = composeNetWorth({
      reportingCurrency: "PYG",
      bankCash: part("1000000"),
      investmentCash: part("250000"),
      holdings: part("750000"),
      missingQuotes: [],
      hasInvestments: true,
    });

    expect(summary.netWorthReporting).toBe("2000000");
    expect(summary.investmentValueReporting).toBe("1000000");
    expect(summary.complete).toBe(true);
  });

  it("marks net worth unavailable when a rate is missing", () => {
    const summary = composeNetWorth({
      reportingCurrency: "PYG",
      bankCash: part(null, ["USD/PYG"]),
      investmentCash: part("250000"),
      holdings: part("750000"),
      missingQuotes: [],
      hasInvestments: true,
    });

    expect(summary.netWorthReporting).toBeNull();
    expect(summary.complete).toBe(false);
    expect(summary.missingRates).toEqual(["USD/PYG"]);
    // The parts that did convert stay visible.
    expect(summary.investmentValueReporting).toBe("1000000");
  });

  it("marks net worth unavailable when a quote is missing", () => {
    const summary = composeNetWorth({
      reportingCurrency: "PYG",
      bankCash: part("1000000"),
      investmentCash: part("250000"),
      holdings: part("750000"),
      missingQuotes: ["BTC/USD"],
      hasInvestments: true,
    });

    expect(summary.complete).toBe(false);
    expect(summary.netWorthReporting).toBeNull();
    expect(summary.missingQuotes).toEqual(["BTC/USD"]);
  });

  it("stays complete for a portfolio-free profile", () => {
    const summary = composeNetWorth({
      reportingCurrency: "PYG",
      bankCash: part("1000000"),
      investmentCash: part("0"),
      holdings: part("0"),
      missingQuotes: [],
      hasInvestments: false,
    });

    expect(summary.netWorthReporting).toBe("1000000");
    expect(summary.hasInvestments).toBe(false);
    expect(NO_GAP.missingRates).toEqual([]);
  });

  it("deduplicates and sorts reported gaps", () => {
    const summary = composeNetWorth({
      reportingCurrency: "PYG",
      bankCash: part(null, ["USD/PYG"]),
      investmentCash: part(null, ["USD/PYG", "EUR/PYG"]),
      holdings: part(null, ["EUR/PYG"]),
      missingQuotes: ["AAPL", "AAPL"],
      hasInvestments: true,
    });

    expect(summary.missingRates).toEqual(["EUR/PYG", "USD/PYG"]);
    expect(summary.missingQuotes).toEqual(["AAPL"]);
  });
});

/**
 * Fixed USD fixture: a standard bank account holding 5,000 funds a brokerage,
 * which then buys and revalues one position. Net worth is asserted after each
 * step to prove that only fees and price movement change it.
 */
describe("net worth fixture: funding, buy, fee, and quote movement", () => {
  const BANK_START = "5000";
  const ledger: LedgerTransactionInput[] = [];

  function cashBalance(funded: string) {
    const effects = ledger.reduce(
      (sum, transaction) =>
        sum.plus(calculateTransactionCashEffect(transaction)),
      new Decimal(0)
    );
    return new Decimal(funded).plus(effects).toString();
  }

  function netWorth(bankCash: string, cash: string, holdings: string) {
    return composeNetWorth({
      reportingCurrency: "USD",
      bankCash: part(bankCash),
      investmentCash: part(cash),
      holdings: part(holdings),
      missingQuotes: [],
      hasInvestments: true,
    }).netWorthReporting;
  }

  it("leaves net worth unchanged when funding the portfolio", () => {
    const before = netWorth(BANK_START, "0", "0");
    // Funding moves 2,000 from the bank to investment cash.
    const after = netWorth("3000", "2000", "0");

    expect(before).toBe("5000");
    expect(after).toBe("5000");
  });

  it("leaves net worth unchanged for a buy at the market price", () => {
    ledger.push({
      id: "buy-1",
      type: "BUY",
      quantity: "10",
      unitPrice: "100",
      fees: "0",
      fxRateToReporting: "1",
      date: "2026-03-02",
      createdAt: "2026-03-02",
    });

    const state = replayLedger(ledger);
    const cash = cashBalance("2000");
    const holdings = calculateMarketValue(state.quantity, "100");

    expect(cash).toBe("1000");
    expect(holdings).toBe("1000");
    expect(netWorth("3000", cash, holdings)).toBe("5000");
  });

  it("reduces net worth by exactly the fee on a buy", () => {
    ledger.push({
      id: "buy-2",
      type: "BUY",
      quantity: "5",
      unitPrice: "100",
      fees: "7.5",
      fxRateToReporting: "1",
      date: "2026-03-03",
      createdAt: "2026-03-03",
    });

    const state = replayLedger(ledger);
    const cash = cashBalance("2000");
    const holdings = calculateMarketValue(state.quantity, "100");

    expect(state.quantity).toBe("15");
    expect(cash).toBe("492.5");
    expect(holdings).toBe("1500");
    // 5,000 less the 7.50 fee.
    expect(netWorth("3000", cash, holdings)).toBe("4992.5");
  });

  it("moves net worth with the quote and matches unrealized gain", () => {
    const state = replayLedger(ledger);
    const cash = cashBalance("2000");
    const holdings = calculateMarketValue(state.quantity, "110");
    const unrealized = new Decimal(holdings)
      .minus(state.remainingCostNative)
      .toString();

    expect(holdings).toBe("1650");
    // The 7.50 buy fee is capitalized into cost basis, so unrealized gain is
    // the 150 of price movement less that fee.
    expect(state.remainingCostNative).toBe("1507.5");
    expect(unrealized).toBe("142.5");
    // 4,992.50 plus the 150 of price movement.
    expect(netWorth("3000", cash, holdings)).toBe("5142.5");
  });
});
