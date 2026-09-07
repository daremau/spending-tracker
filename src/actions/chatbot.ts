"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { confirmDraftSchema } from "@/lib/chatbot/schemas";
import { learnMemoryRule } from "./chatbot-memory";
import { getOrCreateDigitalTaxCategory } from "./categories";

type TxType = "INCOME" | "EXPENSE" | "TRANSFER";

async function applyBalance(
  tx: Prisma.TransactionClient,
  data: { type: TxType; amount: number; accountId: string; toAccountId: string | null }
) {
  if (data.type === "INCOME") {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { increment: data.amount } },
    });
  } else if (data.type === "EXPENSE") {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { decrement: data.amount } },
    });
  } else if (data.type === "TRANSFER" && data.toAccountId) {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { decrement: data.amount } },
    });
    await tx.bankAccount.update({
      where: { id: data.toAccountId },
      data: { balance: { increment: data.amount } },
    });
  }
}

export async function createChatbotTransactions(
  drafts: unknown,
  options?: { batchId?: string }
) {
  const list = Array.isArray(drafts) ? drafts.slice(0, 50) : [];
  if (list.length === 0) return { error: "No hay transacciones para cargar" };

  const parsed = list.map((d) => confirmDraftSchema.safeParse(d));
  const bad = parsed.findIndex((p) => !p.success);
  if (bad !== -1) {
    return { error: `Fila ${bad + 1}: completa tipo, monto y cuenta` };
  }
  const rows = parsed.flatMap((p) =>
    p.success
      ? [
          p.data as unknown as {
            merchant: string;
            amount: number;
            date: string;
            type: TxType;
            categoryId?: string | null;
            accountId?: string | null;
            toAccountId?: string | null;
            description?: string | null;
            applyDigitalTax?: boolean;
          },
        ]
      : []
  );

  // Validar cuentas estándar y categorías existentes.
  const accountIds = Array.from(
    new Set(
      rows.flatMap((r) =>
        [r.accountId, r.toAccountId].filter((x): x is string => Boolean(x))
      )
    )
  );
  const accounts = await prisma.bankAccount.findMany({
    where: { id: { in: accountIds }, kind: "STANDARD" },
    select: { id: true },
  });
  if (accounts.length !== accountIds.length) {
    return { error: "Hay una cuenta inválida o no estándar" };
  }
  for (const [i, r] of rows.entries()) {
    if (!r.accountId) return { error: `Fila ${i + 1}: falta la cuenta` };
    if (r.type === "TRANSFER") {
      if (!r.toAccountId) return { error: `Fila ${i + 1}: falta cuenta destino` };
      if (r.accountId === r.toAccountId) {
        return { error: `Fila ${i + 1}: origen y destino iguales` };
      }
    }
  }
  const categoryIds = Array.from(
    new Set(rows.map((r) => r.categoryId).filter((x): x is string => Boolean(x)))
  );
  if (categoryIds.length > 0) {
    const cats = await prisma.category.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true },
    });
    if (cats.length !== categoryIds.length) {
      return { error: "Hay una categoría inválida" };
    }
  }

  const needsTax = rows.some((r) => r.applyDigitalTax && r.type === "EXPENSE");
  const taxCategory = needsTax ? await getOrCreateDigitalTaxCategory() : null;
  const batchId = options?.batchId ?? randomUUID();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const [i, r] of rows.entries()) {
      const date = new Date(`${r.date}T12:00:00.000Z`);
      const created = await tx.transaction.create({
        data: {
          type: r.type,
          source: "CHATBOT",
          amount: r.amount,
          description: (r.description || r.merchant).slice(0, 300),
          date: Number.isNaN(date.getTime()) ? new Date() : date,
          accountId: r.accountId as string,
          categoryId: r.type === "TRANSFER" ? null : (r.categoryId ?? null),
          toAccountId: r.type === "TRANSFER" ? (r.toAccountId as string) : null,
          clientRequestId: `chatbot-${batchId}-${i}`,
        },
      });
      await applyBalance(tx, {
        type: r.type,
        amount: r.amount,
        accountId: r.accountId as string,
        toAccountId: r.type === "TRANSFER" ? (r.toAccountId as string) : null,
      });

      if (r.applyDigitalTax && r.type === "EXPENSE" && taxCategory) {
        const taxAmount = Math.round(r.amount * 0.1 * 100) / 100;
        await tx.transaction.create({
          data: {
            type: "EXPENSE",
            source: "CHATBOT",
            amount: taxAmount,
            description: `${(r.description || r.merchant).slice(0, 270)} - IVA Digital 10%`,
            date: created.date,
            accountId: r.accountId as string,
            categoryId: taxCategory.id,
            isDigitalTax: true,
            parentTransactionId: created.id,
            clientRequestId: `chatbot-${batchId}-${i}-iva`,
          },
        });
        await applyBalance(tx, {
          type: "EXPENSE",
          amount: taxAmount,
          accountId: r.accountId as string,
          toAccountId: null,
        });
      }
    }
  });

  // Aprende memoria (fuera de la tx principal para no bloquear).
  for (const r of rows) {
    await learnMemoryRule({
      merchant: r.merchant,
      type: r.type,
      categoryId: r.type === "TRANSFER" ? null : (r.categoryId ?? null),
      accountId: r.accountId ?? null,
      toAccountId: r.type === "TRANSFER" ? (r.toAccountId ?? null) : null,
    });
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/analytics");
  revalidatePath("/chat");
  return { success: true, count: rows.length };
}
