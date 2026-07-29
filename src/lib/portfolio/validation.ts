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
const requestId = z.string().uuid("Invalid request identifier");

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
  clientRequestId: requestId,
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

export const portfolioTransferSchema = z.object({
  clientRequestId: requestId,
  accountId: requiredId,
  bankAccountId: requiredId,
  direction: z.enum(["FUND", "WITHDRAW"]),
  amount: positiveDecimal(10, 2),
  date: z.coerce.date(),
  notes: z.string().trim().max(500).optional().default(""),
});

export const investmentActivitySchema = z
  .object({
    clientRequestId: requestId,
    accountId: requiredId,
    assetId: z.string().trim().optional().default(""),
    type: z.enum(["BUY", "SELL", "DIVIDEND", "FEE"]),
    quantity: z.string().trim().optional().default(""),
    unitPrice: z.string().trim().optional().default(""),
    cashAmount: z.string().trim().optional().default(""),
    fees: z.string().trim().optional().default("0"),
    fxRateToReporting: positiveDecimal(14, 10),
    date: z.coerce.date(),
    notes: z.string().trim().max(500).optional().default(""),
  })
  .superRefine((value, context) => {
    if (value.type !== "FEE" && !value.assetId) {
      context.addIssue({
        code: "custom",
        path: ["assetId"],
        message: "An asset is required for this activity",
      });
    }

    if (value.type === "BUY" || value.type === "SELL") {
      for (const [field, candidate, schema] of [
        ["quantity", value.quantity, positiveDecimal(18, 12)],
        ["unitPrice", value.unitPrice, positiveDecimal(16, 8)],
      ] as const) {
        const parsed = schema.safeParse(candidate);
        if (!parsed.success) {
          context.addIssue({
            code: "custom",
            path: [field],
            message: parsed.error.issues[0]?.message ?? `Invalid ${field}`,
          });
        }
      }
    }

    if (value.type === "DIVIDEND" || value.type === "FEE") {
      const parsed = positiveDecimal(16, 8).safeParse(value.cashAmount);
      if (!parsed.success) {
        context.addIssue({
          code: "custom",
          path: ["cashAmount"],
          message: parsed.error.issues[0]?.message ?? "Invalid cash amount",
        });
      }
    }

    const parsedFees = nonNegativeDecimal(16, 8).safeParse(
      value.type === "FEE" ? "0" : value.fees || "0"
    );
    if (!parsedFees.success) {
      context.addIssue({
        code: "custom",
        path: ["fees"],
        message: parsedFees.error.issues[0]?.message ?? "Invalid fees",
      });
    }
  });
