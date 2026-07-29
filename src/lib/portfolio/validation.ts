import Decimal from "decimal.js";
import { z } from "zod";
import { currencyCodeSchema } from "../money/validation";

const positiveDecimal = (integerDigits: number, fractionalDigits: number) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        new RegExp(
          `^\\d{1,${integerDigits}}(?:\\.\\d{1,${fractionalDigits}})?$`
        ).test(value),
      `Use a positive number with up to ${fractionalDigits} decimal places`
    )
    .refine((value) => {
      try {
        return new Decimal(value).greaterThan(0);
      } catch {
        return false;
      }
    }, "Value must be greater than zero");

const nonNegativeDecimal = (integerDigits: number, fractionalDigits: number) =>
  z
    .string()
    .trim()
    .refine(
      (value) =>
        new RegExp(
          `^\\d{1,${integerDigits}}(?:\\.\\d{1,${fractionalDigits}})?$`
        ).test(value),
      `Use zero or a positive number with up to ${fractionalDigits} decimal places`
    );

const requiredId = z.string().trim().min(1, "A referenced record is required");

export const investmentAccountSchema = z.object({
  name: z.string().trim().min(1, "Account name is required").max(80),
  type: z.enum(["BROKERAGE", "EXCHANGE", "WALLET"]),
  cashCurrency: currencyCodeSchema,
});

export const manualAssetSchema = z.object({
  type: z.enum(["STOCK", "ETF", "CRYPTO"]),
  symbol: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(
      z
        .string()
        .min(1, "Symbol is required")
        .max(30)
        .regex(
          /^[A-Z0-9][A-Z0-9./:_-]*$/,
          "Use letters, numbers, or standard market separators"
        )
    ),
  name: z.string().trim().min(1, "Asset name is required").max(120),
  market: z
    .string()
    .trim()
    .transform((value) => value.toUpperCase())
    .pipe(z.string().min(1, "Market is required").max(40)),
  quoteCurrency: currencyCodeSchema,
});

export const openingPositionSchema = z.object({
  clientRequestId: z.string().uuid("Invalid request identifier"),
  accountId: requiredId,
  assetId: requiredId,
  quantity: positiveDecimal(18, 12),
  unitPrice: positiveDecimal(16, 8),
  fees: nonNegativeDecimal(16, 8).default("0"),
  fxRateToReporting: positiveDecimal(14, 10),
  date: z.coerce.date(),
  notes: z.string().trim().max(500).optional().default(""),
});

export const manualQuoteSchema = z.object({
  assetId: requiredId,
  price: positiveDecimal(16, 8),
  asOf: z.coerce.date(),
});
