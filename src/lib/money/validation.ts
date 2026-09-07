import Decimal from "decimal.js";
import { z } from "zod";

export const currencyCodeSchema = z
  .string()
  .trim()
  .transform((value) => value.toUpperCase())
  .pipe(
    z
      .string()
      .regex(/^[A-Z]{3}$/, "Use a three-letter currency code, such as PYG or USD")
  );

export const positiveExchangeRateSchema = z
  .string()
  .trim()
  .refine(
    (value) => /^\d{1,14}(?:\.\d{1,10})?$/.test(value),
    "Use a positive number with up to 10 decimal places"
  )
  .refine((value) => {
    try {
      return new Decimal(value).greaterThan(0);
    } catch {
      return false;
    }
  }, "The exchange rate must be greater than zero");

export const manualExchangeRateSchema = z
  .object({
    fromCurrency: currencyCodeSchema,
    toCurrency: currencyCodeSchema,
    rate: positiveExchangeRateSchema,
  })
  .refine((value) => value.fromCurrency !== value.toCurrency, {
    path: ["toCurrency"],
    message: "Choose two different currencies; same-currency rates are always 1",
  });
