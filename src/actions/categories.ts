"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

type CategoryType = "INCOME" | "EXPENSE";

export async function getCategories(type?: CategoryType) {
  return prisma.category.findMany({
    where: type ? { type } : undefined,
    orderBy: { name: "asc" },
  });
}

export async function createCategory(formData: FormData) {
  const name = formData.get("name") as string;
  const type = formData.get("type") as CategoryType;
  const color = (formData.get("color") as string) || "#6366f1";

  if (!name || !type) {
    return { error: "Name and type are required" };
  }

  const existing = await prisma.category.findFirst({
    where: { name, type },
  });

  if (existing) {
    return { error: "Category already exists" };
  }

  await prisma.category.create({
    data: { name, type, color },
  });

  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteCategory(id: string) {
  await prisma.category.delete({
    where: { id },
  });

  revalidatePath("/transactions");
  return { success: true };
}

export async function seedDefaultCategories() {
  const existing = await prisma.category.count();
  if (existing > 0) return;

  const defaultCategories = [
    { name: "Salary", type: "INCOME" as const, color: "#22c55e" },
    { name: "Freelance", type: "INCOME" as const, color: "#10b981" },
    { name: "Investment", type: "INCOME" as const, color: "#14b8a6" },
    { name: "Other Income", type: "INCOME" as const, color: "#06b6d4" },
    { name: "Food & Dining", type: "EXPENSE" as const, color: "#f43f5e" },
    { name: "Transportation", type: "EXPENSE" as const, color: "#ef4444" },
    { name: "Shopping", type: "EXPENSE" as const, color: "#f97316" },
    { name: "Bills & Utilities", type: "EXPENSE" as const, color: "#eab308" },
    { name: "Entertainment", type: "EXPENSE" as const, color: "#a855f7" },
    { name: "Healthcare", type: "EXPENSE" as const, color: "#ec4899" },
    { name: "Other Expense", type: "EXPENSE" as const, color: "#6366f1" },
  ];

  await prisma.category.createMany({ data: defaultCategories });
}
