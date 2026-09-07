import { describe, expect, it } from "vitest";
import { aggregateMoney, convertAmount } from "./conversion";

describe("currency conversion", () => {
  it("uses one for the same currency without requiring a stored rate", () => {
    expect(convertAmount({ amount: "123.45678901", currency: "pyg" }, "PYG", []))
      .toEqual({
        value: "123.45678901",
        currency: "PYG",
        complete: true,
        missingRates: [],
      });
  });

  it("converts a directional rate with decimal arithmetic", () => {
    expect(
      convertAmount({ amount: "100", currency: "USD" }, "PYG", [
        {
          fromCurrency: "USD",
          toCurrency: "PYG",
          rate: "7500",
          source: "MANUAL",
        },
      ])
    ).toMatchObject({ value: "750000", complete: true });
  });

  it("does not silently invert the opposite pair", () => {
    expect(
      convertAmount({ amount: "100", currency: "USD" }, "PYG", [
        {
          fromCurrency: "PYG",
          toCurrency: "USD",
          rate: "0.0001333333",
          source: "MANUAL",
        },
      ])
    ).toEqual({
      value: null,
      currency: "PYG",
      complete: false,
      missingRates: ["USD -> PYG"],
    });
  });

  it("rejects a non-positive stored rate", () => {
    expect(() =>
      convertAmount({ amount: "100", currency: "USD" }, "PYG", [
        {
          fromCurrency: "USD",
          toCurrency: "PYG",
          rate: "0",
          source: "MANUAL",
        },
      ])
    ).toThrow("must be positive");
  });

  it("produces the documented mixed-currency dashboard total", () => {
    expect(
      aggregateMoney(
        [
          { amount: "1000000", currency: "PYG" },
          { amount: "100", currency: "USD" },
        ],
        "PYG",
        [
          {
            fromCurrency: "USD",
            toCurrency: "PYG",
            rate: "7500",
            source: "MANUAL",
          },
        ]
      )
    ).toEqual({
      value: "1750000",
      currency: "PYG",
      complete: true,
      missingRates: [],
    });
  });

  it("marks an aggregate incomplete instead of returning a partial total", () => {
    expect(
      aggregateMoney(
        [
          { amount: "1000000", currency: "PYG" },
          { amount: "100", currency: "USD" },
          { amount: "50", currency: "USD" },
        ],
        "PYG",
        []
      )
    ).toEqual({
      value: null,
      currency: "PYG",
      complete: false,
      missingRates: ["USD -> PYG"],
    });
  });

  it("retains eight-decimal precision through aggregation", () => {
    expect(
      aggregateMoney(
        [
          { amount: "0.12345678", currency: "USD" },
          { amount: "0.00000001", currency: "USD" },
        ],
        "USD",
        []
      )
    ).toMatchObject({ value: "0.12345679", complete: true });
  });

  it("prefers an active manual rate over a provider rate", () => {
    expect(
      convertAmount({ amount: "1", currency: "USD" }, "PYG", [
        {
          fromCurrency: "USD",
          toCurrency: "PYG",
          rate: "7400",
          source: "TWELVE_DATA",
        },
        {
          fromCurrency: "USD",
          toCurrency: "PYG",
          rate: "7500",
          source: "MANUAL",
        },
      ])
    ).toMatchObject({ value: "7500", complete: true });
  });
});
