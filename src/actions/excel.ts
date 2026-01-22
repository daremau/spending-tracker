"use server";

import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_COLUMNS,
  CATEGORY_COLUMNS,
  TRANSACTION_COLUMNS,
} from "@/lib/excel";

function styleHeaderRow(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE5E7EB" },
  };
  headerRow.eachCell((cell) => {
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD1D5DB" } },
    };
  });
}

export async function exportToExcel(): Promise<
  | { success: true; data: string; filename: string }
  | { error: string }
> {
  try {
    // Fetch all data
    const [accounts, categories, transactions] = await Promise.all([
      prisma.bankAccount.findMany({ orderBy: { name: "asc" } }),
      prisma.category.findMany({ orderBy: { name: "asc" } }),
      prisma.transaction.findMany({
        include: { account: true, category: true, toAccount: true },
        orderBy: { date: "desc" },
      }),
    ]);

    // Create workbook
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    workbook.creator = "Spending Tracker";

    // Accounts sheet
    const accountsSheet = workbook.addWorksheet("Accounts");
    accountsSheet.columns = ACCOUNT_COLUMNS.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));
    accounts.forEach((account) => {
      accountsSheet.addRow({
        name: account.name,
        balance: Number(account.balance),
        currency: account.currency,
      });
    });
    styleHeaderRow(accountsSheet);

    // Categories sheet
    const categoriesSheet = workbook.addWorksheet("Categories");
    categoriesSheet.columns = CATEGORY_COLUMNS.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));
    categories.forEach((category) => {
      categoriesSheet.addRow({
        name: category.name,
        type: category.type,
        color: category.color,
        icon: category.icon || "",
      });
    });
    styleHeaderRow(categoriesSheet);

    // Transactions sheet
    const transactionsSheet = workbook.addWorksheet("Transactions");
    transactionsSheet.columns = TRANSACTION_COLUMNS.map((col) => ({
      header: col.header,
      key: col.key,
      width: col.width,
    }));
    transactions.forEach((transaction) => {
      transactionsSheet.addRow({
        type: transaction.type,
        amount: Number(transaction.amount),
        description: transaction.description || "",
        date: transaction.date,
        accountName: transaction.account.name,
        categoryName: transaction.category?.name || "",
        toAccountName: transaction.toAccount?.name || "",
      });
    });
    styleHeaderRow(transactionsSheet);

    // Format date column
    transactionsSheet.getColumn("date").numFmt = "yyyy-mm-dd";

    // Generate buffer and convert to base64
    const buffer = await workbook.xlsx.writeBuffer();
    const base64 = Buffer.from(buffer).toString("base64");

    const filename = `spending-tracker-${new Date().toISOString().split("T")[0]}.xlsx`;

    return { success: true, data: base64, filename };
  } catch (error) {
    console.error("Export error:", error);
    return { error: "Failed to export data" };
  }
}
