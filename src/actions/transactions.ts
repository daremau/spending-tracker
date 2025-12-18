"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
type TransactionBalanceData = {
  type: TransactionType;
  amount: number;
  accountId: string;
  toAccountId: string | null;
};

async function applyTransactionBalance(
  tx: Prisma.TransactionClient,
  data: TransactionBalanceData
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

async function revertTransactionBalance(
  tx: Prisma.TransactionClient,
  data: TransactionBalanceData
) {
  if (data.type === "INCOME") {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { decrement: data.amount } },
    });
  } else if (data.type === "EXPENSE") {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { increment: data.amount } },
    });
  } else if (data.type === "TRANSFER" && data.toAccountId) {
    await tx.bankAccount.update({
      where: { id: data.accountId },
      data: { balance: { increment: data.amount } },
    });
    await tx.bankAccount.update({
      where: { id: data.toAccountId },
      data: { balance: { decrement: data.amount } },
    });
  }
}

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

    await applyTransactionBalance(tx, {
      type,
      amount,
      accountId,
      toAccountId: type === "TRANSFER" ? toAccountId : null,
    });
  });

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/");
  revalidatePath("/analytics");
  return { success: true };
}

export async function updateTransaction(formData: FormData) {
  const id = formData.get("id") as string;
  const type = formData.get("type") as TransactionType;
  const amount = parseFloat(formData.get("amount") as string);
  const description = formData.get("description") as string;
  const accountId = formData.get("accountId") as string;
  const categoryId = formData.get("categoryId") as string | null;
  const toAccountId = formData.get("toAccountId") as string | null;
  const dateStr = formData.get("date") as string;

  if (!id) {
    return { error: "Transaction id is required" };
  }

  if (!type || !Number.isFinite(amount) || !accountId) {
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

  const transaction = await prisma.transaction.findUnique({
    where: { id },
  });

  if (!transaction) {
    return { error: "Transaction not found" };
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  const normalizedCategoryId = type === "TRANSFER" ? null : categoryId || null;
  const normalizedToAccountId =
    type === "TRANSFER" ? (toAccountId as string) : null;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    await revertTransactionBalance(tx, {
      type: transaction.type as TransactionType,
      amount: Number(transaction.amount),
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
    });

    await tx.transaction.update({
      where: { id },
      data: {
        type,
        amount,
        description: description || null,
        date,
        accountId,
        categoryId: normalizedCategoryId,
        toAccountId: normalizedToAccountId,
      },
    });

    await applyTransactionBalance(tx, {
      type,
      amount,
      accountId,
      toAccountId: normalizedToAccountId,
    });
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
    await revertTransactionBalance(tx, {
      type: transaction.type as TransactionType,
      amount: Number(transaction.amount),
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
    });

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
