"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getOrCreateDigitalTaxCategory } from "./categories";

type TransactionType = "INCOME" | "EXPENSE" | "TRANSFER";

const DIGITAL_TAX_RATE = 0.10; // 10%
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

export async function getTransactions(options?: {
  limit?: number;
  accountId?: string;
}) {
  const { limit, accountId } = options || {};

  const transactions = await prisma.transaction.findMany({
    where: accountId
      ? {
          OR: [{ accountId }, { toAccountId: accountId }],
        }
      : undefined,
    include: {
      account: true,
      toAccount: true,
      category: true,
      taxTransaction: true,
      parentTransaction: true,
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
    taxTransaction: t.taxTransaction
      ? { ...t.taxTransaction, amount: Number(t.taxTransaction.amount) }
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
  const applyDigitalTax = formData.get("applyDigitalTax") === "true";

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

  // Get digital tax category if needed
  let digitalTaxCategoryId: string | null = null;
  if (applyDigitalTax && type === "EXPENSE") {
    const taxCategory = await getOrCreateDigitalTaxCategory();
    digitalTaxCategoryId = taxCategory.id;
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const newTransaction = await tx.transaction.create({
      data: {
        type,
        amount,
        description: description || null,
        date,
        accountId,
        categoryId: categoryId || null,
        toAccountId: type === "TRANSFER" ? toAccountId : null,
        isDigitalTax: false,
      },
    });

    await applyTransactionBalance(tx, {
      type,
      amount,
      accountId,
      toAccountId: type === "TRANSFER" ? toAccountId : null,
    });

    // Create digital tax transaction if requested
    if (applyDigitalTax && type === "EXPENSE" && digitalTaxCategoryId) {
      const taxAmount = Math.round(amount * DIGITAL_TAX_RATE * 100) / 100;
      const taxDescription = description
        ? `${description} - IVA Digital 10%`
        : "IVA Digital 10%";

      await tx.transaction.create({
        data: {
          type: "EXPENSE",
          amount: taxAmount,
          description: taxDescription,
          date,
          accountId,
          categoryId: digitalTaxCategoryId,
          isDigitalTax: true,
          parentTransactionId: newTransaction.id,
        },
      });

      await applyTransactionBalance(tx, {
        type: "EXPENSE",
        amount: taxAmount,
        accountId,
        toAccountId: null,
      });
    }
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
  const applyDigitalTax = formData.get("applyDigitalTax") === "true";

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
    include: { taxTransaction: true },
  });

  if (!transaction) {
    return { error: "Transaction not found" };
  }

  // Block editing tax transactions directly
  if (transaction.isDigitalTax) {
    return { error: "No se puede editar transacciones de IVA directamente. Edita la transacción original." };
  }

  const date = dateStr ? new Date(dateStr) : new Date();
  const normalizedCategoryId = type === "TRANSFER" ? null : categoryId || null;
  const normalizedToAccountId =
    type === "TRANSFER" ? (toAccountId as string) : null;

  // Get digital tax category if needed
  let digitalTaxCategoryId: string | null = null;
  if (applyDigitalTax && type === "EXPENSE") {
    const taxCategory = await getOrCreateDigitalTaxCategory();
    digitalTaxCategoryId = taxCategory.id;
  }

  const existingTaxTransaction = transaction.taxTransaction;

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Revert main transaction balance
    await revertTransactionBalance(tx, {
      type: transaction.type as TransactionType,
      amount: Number(transaction.amount),
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
    });

    // Revert existing tax transaction balance if it exists
    if (existingTaxTransaction) {
      await revertTransactionBalance(tx, {
        type: "EXPENSE",
        amount: Number(existingTaxTransaction.amount),
        accountId: existingTaxTransaction.accountId,
        toAccountId: null,
      });

      // Delete existing tax transaction
      await tx.transaction.delete({
        where: { id: existingTaxTransaction.id },
      });
    }

    // Update main transaction
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

    // Apply new balance
    await applyTransactionBalance(tx, {
      type,
      amount,
      accountId,
      toAccountId: normalizedToAccountId,
    });

    // Create new tax transaction if requested
    if (applyDigitalTax && type === "EXPENSE" && digitalTaxCategoryId) {
      const taxAmount = Math.round(amount * DIGITAL_TAX_RATE * 100) / 100;
      const taxDescription = description
        ? `${description} - IVA Digital 10%`
        : "IVA Digital 10%";

      await tx.transaction.create({
        data: {
          type: "EXPENSE",
          amount: taxAmount,
          description: taxDescription,
          date,
          accountId,
          categoryId: digitalTaxCategoryId,
          isDigitalTax: true,
          parentTransactionId: id,
        },
      });

      await applyTransactionBalance(tx, {
        type: "EXPENSE",
        amount: taxAmount,
        accountId,
        toAccountId: null,
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
    include: { taxTransaction: true },
  });

  if (!transaction) {
    return { error: "Transaction not found" };
  }

  // Block deleting tax transactions directly
  if (transaction.isDigitalTax) {
    return { error: "No se puede eliminar transacciones de IVA directamente. Elimina la transacción original." };
  }

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    // Revert main transaction balance
    await revertTransactionBalance(tx, {
      type: transaction.type as TransactionType,
      amount: Number(transaction.amount),
      accountId: transaction.accountId,
      toAccountId: transaction.toAccountId,
    });

    // Revert tax transaction balance if it exists
    if (transaction.taxTransaction) {
      await revertTransactionBalance(tx, {
        type: "EXPENSE",
        amount: Number(transaction.taxTransaction.amount),
        accountId: transaction.taxTransaction.accountId,
        toAccountId: null,
      });
    }

    // Delete transaction (tax transaction is deleted by cascade)
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
