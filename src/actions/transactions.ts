"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

export async function getTransactions(limit?: number) {
  const transactions = await prisma.transaction.findMany({
    include: {
      account: true,
      toAccount: true,
      category: true,
    },
    orderBy: { date: "desc" },
    take: limit,
  });

  return transactions.map((t: typeof transactions[number]) => ({
    ...t,
    amount: Number(t.amount),
    account: { ...t.account, balance: Number(t.account.balance) },
    toAccount: t.toAccount
      ? { ...t.toAccount, balance: Number(t.toAccount.balance) }
      : null,
  }));
}

export async function createTransaction(formData: FormData) {
  const type = formData.get("type") as TransactionType;
  const amount = parseFloat(formData.get("amount") as string);
  const description = formData.get("description") as string;
  const accountId = formData.get("accountId") as string;
  const categoryId = formData.get("categoryId") as string | null;
  const toAccountId = formData.get("toAccountId") as string | null;
  const dateStr = formData.get("date") as string;

  if (!type || !amount || !accountId) {
    return { error: "Type, amount, and account are required" };
  }

  if (amount <= 0) {
    return { error: "Amount must be positive" };
  }

  if (type === "TRANSFER" && !toAccountId) {
    return { error: "Destination account is required for transfers" };
  }

  if (type === "TRANSFER" && accountId === toAccountId) {
    return { error: "Cannot transfer to the same account" };
  }

  const date = dateStr ? new Date(dateStr) : new Date();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await tx.transaction.create({
      data: {
        type,
        amount,
        description: description || null,
        date,
        accountId,
        categoryId: categoryId || null,
        toAccountId: type === "TRANSFER" ? toAccountId : null,
      },
    });

    if (type === "INCOME") {
      await tx.bankAccount.update({
        where: { id: accountId },
        data: { balance: { increment: amount } },
      });
    } else if (type === "EXPENSE") {
      await tx.bankAccount.update({
        where: { id: accountId },
        data: { balance: { decrement: amount } },
      });
    } else if (type === "TRANSFER" && toAccountId) {
      await tx.bankAccount.update({
        where: { id: accountId },
        data: { balance: { decrement: amount } },
      });
      await tx.bankAccount.update({
        where: { id: toAccountId },
        data: { balance: { increment: amount } },
      });
    }
  });

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/analytics");
  return { success: true };
}

export async function deleteTransaction(id: string) {
  const transaction = await prisma.transaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    return { error: "Transaction not found" };
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    if (transaction.type === "INCOME") {
      await tx.bankAccount.update({
        where: { id: transaction.accountId },
        data: { balance: { decrement: transaction.amount } },
      });
    } else if (transaction.type === "EXPENSE") {
      await tx.bankAccount.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: transaction.amount } },
      });
    } else if (transaction.type === "TRANSFER" && transaction.toAccountId) {
      await tx.bankAccount.update({
        where: { id: transaction.accountId },
        data: { balance: { increment: transaction.amount } },
      });
      await tx.bankAccount.update({
        where: { id: transaction.toAccountId },
        data: { balance: { decrement: transaction.amount } },
      });
    }

    await tx.transaction.delete({
      where: { id },
    });
  });

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/analytics");
  return { success: true };
}
