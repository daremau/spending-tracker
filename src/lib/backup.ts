import { prisma } from "./prisma";
import ExcelJS from "exceljs";

export interface BackupData {
  accounts: Array<{
    name: string;
    balance: number;
    currency: string;
  }>;
  categories: Array<{
    name: string;
    type: "INCOME" | "EXPENSE";
    color: string;
    icon: string | null;
  }>;
  transactions: Array<{
    type: "INCOME" | "EXPENSE" | "TRANSFER";
    amount: number;
    description: string | null;
    date: Date;
    accountName: string;
    categoryName: string | null;
    toAccountName: string | null;
  }>;
}

export async function getBackupData(): Promise<BackupData> {
  const [accounts, categories, transactions] = await Promise.all([
    prisma.bankAccount.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    prisma.transaction.findMany({
      include: { account: true, category: true, toAccount: true },
      orderBy: { date: "desc" },
    }),
  ]);

  return {
    accounts: accounts.map((a) => ({
      name: a.name,
      balance: Number(a.balance),
      currency: a.currency,
    })),
    categories: categories.map((c) => ({
      name: c.name,
      type: c.type as "INCOME" | "EXPENSE",
      color: c.color,
      icon: c.icon,
    })),
    transactions: transactions.map((t) => ({
      type: t.type as "INCOME" | "EXPENSE" | "TRANSFER",
      amount: Number(t.amount),
      description: t.description,
      date: t.date,
      accountName: t.account.name,
      categoryName: t.category?.name || null,
      toAccountName: t.toAccount?.name || null,
    })),
  };
}

export function exportToCSV(data: BackupData): string {
  const lines: string[] = [];

  lines.push("# ACCOUNTS");
  lines.push("Name,Balance,Currency");
  for (const acc of data.accounts) {
    lines.push(`"${acc.name}",${acc.balance},"${acc.currency}"`);
  }

  lines.push("");
  lines.push("# CATEGORIES");
  lines.push("Name,Type,Color,Icon");
  for (const cat of data.categories) {
    lines.push(`"${cat.name}","${cat.type}","${cat.color}","${cat.icon || ""}"`);
  }

  lines.push("");
  lines.push("# TRANSACTIONS");
  lines.push("Type,Amount,Description,Date,Account,Category,ToAccount");
  for (const t of data.transactions) {
    const date = t.date.toISOString().split("T")[0];
    const desc = t.description?.replace(/"/g, '""') || "";
    lines.push(
      `"${t.type}",${t.amount},"${desc}",${date},"${t.accountName}","${t.categoryName || ""}","${t.toAccountName || ""}"`
    );
  }

  return lines.join("\n");
}

export async function exportToExcel(data: BackupData): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.creator = "Spending Tracker";

  const accountsSheet = workbook.addWorksheet("Accounts");
  accountsSheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Balance", key: "balance", width: 15 },
    { header: "Currency", key: "currency", width: 10 },
  ];
  accountsSheet.addRows(data.accounts.map((a) => ({ name: a.name, balance: a.balance, currency: a.currency })));

  const categoriesSheet = workbook.addWorksheet("Categories");
  categoriesSheet.columns = [
    { header: "Name", key: "name", width: 25 },
    { header: "Type", key: "type", width: 10 },
    { header: "Color", key: "color", width: 12 },
    { header: "Icon", key: "icon", width: 15 },
  ];
  categoriesSheet.addRows(data.categories.map((c) => ({ name: c.name, type: c.type, color: c.color, icon: c.icon || "" })));

  const transactionsSheet = workbook.addWorksheet("Transactions");
  transactionsSheet.columns = [
    { header: "Type", key: "type", width: 12 },
    { header: "Amount", key: "amount", width: 15 },
    { header: "Description", key: "description", width: 30 },
    { header: "Date", key: "date", width: 15 },
    { header: "Account", key: "accountName", width: 25 },
    { header: "Category", key: "categoryName", width: 20 },
    { header: "ToAccount", key: "toAccountName", width: 25 },
  ];
  transactionsSheet.addRows(
    data.transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      description: t.description || "",
      date: t.date,
      accountName: t.accountName,
      categoryName: t.categoryName || "",
      toAccountName: t.toAccountName || "",
    }))
  );
  transactionsSheet.getColumn("date").numFmt = "yyyy-mm-dd";

  [accountsSheet, categoriesSheet, transactionsSheet].forEach((sheet) => {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export interface ParsedBackup {
  accounts: BackupData["accounts"];
  categories: BackupData["categories"];
  transactions: BackupData["transactions"];
  errors: string[];
}

export function parseCSV(content: string): ParsedBackup {
  const result: ParsedBackup = {
    accounts: [],
    categories: [],
    transactions: [],
    errors: [],
  };

  const sections = content.split("\n\n");
  let currentSection = "";

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    const lines = trimmed.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines[0] === "# ACCOUNTS") {
      currentSection = "accounts";
    } else if (lines[0] === "# CATEGORIES") {
      currentSection = "categories";
    } else if (lines[0] === "# TRANSACTIONS") {
      currentSection = "transactions";
    } else if (currentSection === "accounts" && lines[0]) {
      for (const line of lines) {
        const match = line.match(/^"([^"]+)","?([^,"]+)"?,?"?([^,"]*)"?$/);
        if (match) {
          result.accounts.push({
            name: match[1],
            balance: parseFloat(match[2]) || 0,
            currency: match[3] || "PYG",
          });
        }
      }
    } else if (currentSection === "categories" && lines[0]) {
      for (const line of lines) {
        const match = line.match(/^"([^"]+)","(INCOME|EXPENSE)","([^"]+)","?([^"]*)"?$/);
        if (match) {
          result.categories.push({
            name: match[1],
            type: match[2] as "INCOME" | "EXPENSE",
            color: match[3],
            icon: match[4] || null,
          });
        }
      }
    } else if (currentSection === "transactions" && lines[0]) {
      for (const line of lines) {
        const parts = line.match(/(?:^|,)\s*"([^"]*(?:""[^"]*)*)"\s*/g) || [];
        const values = parts.map((p) => p.replace(/^,?\s*"/, "").replace(/"\s*$/, "").replace(/""/g, '"').trim());

        if (values.length >= 5 && ["INCOME", "EXPENSE", "TRANSFER"].includes(values[0])) {
          result.transactions.push({
            type: values[0] as "INCOME" | "EXPENSE" | "TRANSFER",
            amount: parseFloat(values[1]) || 0,
            description: values[2] || null,
            date: new Date(values[3]),
            accountName: values[4],
            categoryName: values[5] || null,
            toAccountName: values[6] || null,
          });
        }
      }
    }
  }

  return result;
}

export async function parseExcel(buffer: Buffer): Promise<ParsedBackup> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const result: ParsedBackup = {
    accounts: [],
    categories: [],
    transactions: [],
    errors: [],
  };

  const accountsSheet = workbook.getWorksheet("Accounts");
  if (accountsSheet) {
    accountsSheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const name = row.getCell(1).text?.toString().trim();
      const balance = parseFloat(row.getCell(2).text || "0");
      const currency = row.getCell(3).text?.toString().trim() || "PYG";
      if (name) {
        result.accounts.push({ name, balance, currency });
      }
    });
  }

  const categoriesSheet = workbook.getWorksheet("Categories");
  if (categoriesSheet) {
    categoriesSheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const name = row.getCell(1).text?.toString().trim();
      const type = row.getCell(2).text?.toString().trim().toUpperCase();
      const color = row.getCell(3).text?.toString().trim() || "#6366f1";
      const icon = row.getCell(4).text?.toString().trim() || null;
      if (name && (type === "INCOME" || type === "EXPENSE")) {
        result.categories.push({ name, type: type as "INCOME" | "EXPENSE", color, icon });
      }
    });
  }

  const transactionsSheet = workbook.getWorksheet("Transactions");
  if (transactionsSheet) {
    transactionsSheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return;
      const type = row.getCell(1).text?.toString().trim().toUpperCase();
      const amount = parseFloat(row.getCell(2).text || "0");
      const description = row.getCell(3).text?.toString().trim() || null;
      const dateVal = row.getCell(4).value;
      const date = dateVal instanceof Date ? dateVal : new Date(row.getCell(4).text || Date.now());
      const accountName = row.getCell(5).text?.toString().trim();
      const categoryName = row.getCell(6).text?.toString().trim() || null;
      const toAccountName = row.getCell(7).text?.toString().trim() || null;

      if (type && ["INCOME", "EXPENSE", "TRANSFER"].includes(type) && accountName) {
        result.transactions.push({
          type: type as "INCOME" | "EXPENSE" | "TRANSFER",
          amount,
          description,
          date,
          accountName,
          categoryName,
          toAccountName,
        });
      }
    });
  }

  return result;
}

export interface ImportResult {
  success: boolean;
  accountsCreated: number;
  categoriesCreated: number;
  transactionsCreated: number;
  errors: string[];
}

export async function importBackup(data: ParsedBackup): Promise<ImportResult> {
  const result: ImportResult = {
    success: true,
    accountsCreated: 0,
    categoriesCreated: 0,
    transactionsCreated: 0,
    errors: [],
  };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.transaction.deleteMany({});
      await tx.bankAccount.deleteMany({});
      await tx.category.deleteMany({});

      const accountMap = new Map<string, string>();
      for (const acc of data.accounts) {
        const created = await tx.bankAccount.create({
          data: { name: acc.name, balance: acc.balance, currency: acc.currency },
        });
        accountMap.set(acc.name.toLowerCase(), created.id);
        result.accountsCreated++;
      }

      const categoryMap = new Map<string, string>();
      for (const cat of data.categories) {
        const created = await tx.category.create({
          data: { name: cat.name, type: cat.type, color: cat.color, icon: cat.icon },
        });
        categoryMap.set(`${cat.name.toLowerCase()}:${cat.type}`, created.id);
        result.categoriesCreated++;
      }

      for (const t of data.transactions) {
        const accountId = accountMap.get(t.accountName.toLowerCase());
        if (!accountId) {
          result.errors.push(`Account "${t.accountName}" not found`);
          continue;
        }

        let toAccountId: string | null = null;
        if (t.type === "TRANSFER" && t.toAccountName) {
          toAccountId = accountMap.get(t.toAccountName.toLowerCase()) || null;
          if (!toAccountId) {
            result.errors.push(`ToAccount "${t.toAccountName}" not found`);
            continue;
          }
        }

        let categoryId: string | null = null;
        if (t.categoryName) {
          const catType = t.type === "INCOME" ? "INCOME" : "EXPENSE";
          categoryId = categoryMap.get(`${t.categoryName.toLowerCase()}:${catType}`) || null;
        }

        await tx.transaction.create({
          data: {
            type: t.type,
            amount: t.amount,
            description: t.description,
            date: t.date,
            accountId,
            categoryId,
            toAccountId,
          },
        });
        result.transactionsCreated++;
      }
    });
  } catch (error) {
    result.success = false;
    result.errors.push(error instanceof Error ? error.message : "Unknown error");
  }

  return result;
}
