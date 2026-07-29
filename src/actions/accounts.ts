"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { amountToNumber } from "@/lib/format";

export async function getAccounts() {
  const accounts = await prisma.bankAccount.findMany({
    where: { kind: "STANDARD" },
    orderBy: { createdAt: "desc" },
  });

  return accounts.map((account) => ({
    ...account,
    balance: Number(account.balance),
  }));
}

export async function getAccountById(id: string) {
  const account = await prisma.bankAccount.findFirst({
    where: { id, kind: "STANDARD" },
  });

  if (!account) return null;

  return {
    ...account,
    balance: Number(account.balance),
  };
}

export async function createAccount(formData: FormData) {
  const name = formData.get("name") as string;
  const balance = amountToNumber(formData.get("balance") as string) || 0;
  const currency = (formData.get("currency") as string) || "USD";

  if (!name) {
    return { error: "Account name is required" };
  }

  await prisma.bankAccount.create({
    data: {
      name,
      balance,
      currency,
    },
  });

  revalidatePath("/accounts");
  revalidatePath("/");
  return { success: true };
}

export async function updateAccount(id: string, formData: FormData) {
  const name = formData.get("name") as string;
  const currency = formData.get("currency") as string;

  if (!name) {
    return { error: "Account name is required" };
  }

  const result = await prisma.bankAccount.updateMany({
    where: { id, kind: "STANDARD" },
    data: { name, currency },
  });
  if (result.count === 0) {
    return { error: "Bank account not found" };
  }

  revalidatePath("/accounts");
  revalidatePath("/");
  return { success: true };
}

export async function deleteAccount(id: string) {
  const account = await prisma.bankAccount.findUnique({
    where: { id },
    select: { kind: true },
  });
  if (!account || account.kind !== "STANDARD") {
    return { error: "Investment cash accounts are managed from Portfolio" };
  }

  await prisma.bankAccount.delete({ where: { id } });

  revalidatePath("/accounts");
  revalidatePath("/");
  return { success: true };
}
