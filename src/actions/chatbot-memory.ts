"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { normalizeMerchant } from "@/lib/chatbot/normalize";

export type MemoryMatch = {
  merchantKey: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  hits: number;
};

export async function findMemoryMatches(
  merchants: string[]
): Promise<Record<string, MemoryMatch>> {
  const keys = Array.from(
    new Set(merchants.map(normalizeMerchant).filter(Boolean))
  );
  if (keys.length === 0) return {};
  const rules = await prisma.chatbotMemoryRule.findMany({
    where: { merchantKey: { in: keys } },
  });
  const out: Record<string, MemoryMatch> = {};
  for (const r of rules) {
    out[r.merchantKey] = {
      merchantKey: r.merchantKey,
      type: r.type,
      categoryId: r.categoryId,
      accountId: r.accountId,
      toAccountId: r.toAccountId,
      hits: r.hits,
    };
  }
  return out;
}

export async function getMemoryRules(limit = 100) {
  return prisma.chatbotMemoryRule.findMany({
    orderBy: [{ hits: "desc" }, { updatedAt: "desc" }],
    take: limit,
  });
}

export async function deleteMemoryRule(id: string) {
  await prisma.chatbotMemoryRule.delete({ where: { id } });
  revalidatePath("/chat");
  return { success: true };
}

/** Aprende/actualiza regla al confirmar o corregir un draft. */
export async function learnMemoryRule(input: {
  merchant: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  categoryId?: string | null;
  accountId?: string | null;
  toAccountId?: string | null;
}) {
  const merchantKey = normalizeMerchant(input.merchant);
  if (!merchantKey) return;
  await prisma.chatbotMemoryRule.upsert({
    where: { merchantKey },
    update: {
      merchantRaw: input.merchant.slice(0, 200),
      type: input.type,
      categoryId: input.categoryId ?? null,
      accountId: input.accountId ?? null,
      toAccountId: input.toAccountId ?? null,
      hits: { increment: 1 },
    },
    create: {
      merchantKey,
      merchantRaw: input.merchant.slice(0, 200),
      type: input.type,
      categoryId: input.categoryId ?? null,
      accountId: input.accountId ?? null,
      toAccountId: input.toAccountId ?? null,
    },
  });
}
