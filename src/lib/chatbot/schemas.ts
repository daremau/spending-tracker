import { z } from "zod";

export const draftTransactionSchema = z.object({
  merchant: z.string().min(1).max(200),
  amount: z.number().positive(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date debe ser YYYY-MM-DD"),
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]).nullable().optional(),
  categoryId: z.string().nullable().optional(),
  categoryName: z.string().nullable().optional(),
  accountId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  description: z.string().max(300).nullable().optional(),
  applyDigitalTax: z.boolean().optional().default(false),
  confidence: z.number().min(0).max(1).optional().default(0.5),
  needsClarification: z.boolean().optional().default(false),
  clarificationQuestion: z.string().nullable().optional(),
});

export type DraftTransaction = z.infer<typeof draftTransactionSchema>;

export const extractResponseSchema = z.object({
  drafts: z.array(draftTransactionSchema).max(50),
});

export type ExtractResponse = z.infer<typeof extractResponseSchema>;

export const confirmDraftSchema = draftTransactionSchema.extend({
  type: z.enum(["INCOME", "EXPENSE", "TRANSFER"]),
});

export type ConfirmDraft = z.infer<typeof confirmDraftSchema>;
