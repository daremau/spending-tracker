"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getAccounts() {
  const accounts = await prisma.bankAccount.findMany({
    orderBy: { createdAt: "desc" },
  });

  return accounts.map((account) => ({
    ...account,
    balance: Number(account.balance),
  }));
}

export async function getAccountById(id: string) {
  const account = await prisma.bankAccount.findUnique({
    where: { id },
  });

  if (!account) return null;

  return {
    ...account,
    balance: Number(account.balance),
  };
}

export async function createAccount(formData: FormData) {
  const name = formData.get("name") as string;
  const balance = parseFloat(formData.get("balance") as string) || 0;
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

  await prisma.bankAccount.update({
    where: { id },
    data: { name, currency },
  });

  revalidatePath("/accounts");
  revalidatePath("/");
  return { success: true };
}

export async function deleteAccount(id: string) {
  await prisma.bankAccount.delete({
    where: { id },
  });

  revalidatePath("/accounts");
  revalidatePath("/");
  return { success: true };
}
