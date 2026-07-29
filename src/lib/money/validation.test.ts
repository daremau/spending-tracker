import { describe, expect, it } from "vitest";
import {
  currencyCodeSchema,
  manualExchangeRateSchema,
} from "./validation";

describe("currency input validation", () => {
  it("normalizes a three-letter currency code", () => {
    expect(currencyCodeSchema.parse(" usd ")).toBe("USD");
  });

  it.each(["US", "USDD", "U1D", ""])(
    "rejects malformed currency code %j",
    (currency) => {
      expect(currencyCodeSchema.safeParse(currency).success).toBe(false);
    }
  );
});

describe("manual exchange-rate validation", () => {
  it("accepts a positive directional rate", () => {
    expect(
      manualExchangeRateSchema.parse({
        fromCurrency: "usd",
        toCurrency: "pyg",
        rate: "7500.1234567890",
      })
    ).toEqual({
      fromCurrency: "USD",
      toCurrency: "PYG",
      rate: "7500.1234567890",
    });
  });

  it.each(["0", "-1", "abc", "1e3", "1.12345678901"])(
    "rejects invalid rate %j",
    (rate) => {
      expect(
        manualExchangeRateSchema.safeParse({
          fromCurrency: "USD",
          toCurrency: "PYG",
          rate,
        }).success
      ).toBe(false);
    }
  );

  it("rejects a same-currency manual rate", () => {
    expect(
      manualExchangeRateSchema.safeParse({
        fromCurrency: "USD",
        toCurrency: "usd",
        rate: "1",
      }).success
    ).toBe(false);
  });
});
