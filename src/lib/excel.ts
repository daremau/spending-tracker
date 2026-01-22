import { z } from "zod";

// Column definitions for Excel sheets
export const ACCOUNT_COLUMNS = [
  { header: "Name", key: "name", width: 25 },
  { header: "Balance", key: "balance", width: 15 },
  { header: "Currency", key: "currency", width: 10 },
] as const;

export const CATEGORY_COLUMNS = [
  { header: "Name", key: "name", width: 25 },
  { header: "Type", key: "type", width: 10 },
  { header: "Color", key: "color", width: 12 },
  { header: "Icon", key: "icon", width: 15 },
] as const;

export const TRANSACTION_COLUMNS = [
  { header: "Type", key: "type", width: 12 },
  { header: "Amount", key: "amount", width: 15 },
  { header: "Description", key: "description", width: 30 },
  { header: "Date", key: "date", width: 15 },
  { header: "Account", key: "accountName", width: 25 },
  { header: "Category", key: "categoryName", width: 20 },
  { header: "To Account", key: "toAccountName", width: 25 },
] as const;

// Supported currencies
export const SUPPORTED_CURRENCIES = ["PYG", "USD", "EUR", "GBP", "BRL", "ARS"];

// Zod validation schemas
export const accountRowSchema = z.object({
  name: z.string().min(1, "Account name is required"),
  balance: z.number().default(0),
  currency: z.string().default("PYG"),
});

export const categoryRowSchema = z.object({
  name: z.string().min(1, "Category name is required"),
  type: z.enum(["INCOME", "EXPENSE"], { message: "Type must be INCOME or EXPENSE" }),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Color must be a valid hex color")
    .default("#6366f1"),
  icon: z.string().nullable().optional().default(null),
});

export const transactionRowSchema = z.object({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"], { message: "Type must be INCOME, EXPENSE, or TRANSFER" }),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().nullable().optional().default(null),
  date: z.date({ message: "Invalid date format" }),
  accountName: z.string().min(1, "Account name is required"),
  categoryName: z.string().nullable().optional().default(null),
  toAccountName: z.string().nullable().optional().default(null),
});
