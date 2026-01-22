import ExcelJS from "exceljs";
import {
  ParsedImportData,
  ImportError,
  AccountRow,
  CategoryRow,
  TransactionRow,
} from "./excel-types";
import {
  accountRowSchema,
  categoryRowSchema,
  transactionRowSchema,
} from "./excel";

export async function parseExcelFile(buffer: Buffer): Promise<ParsedImportData> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const errors: ImportError[] = [];

  const accounts = parseAccountsSheet(workbook, errors);
  const categories = parseCategoriesSheet(workbook, errors);
  const transactions = parseTransactionsSheet(workbook, errors);

  return { accounts, categories, transactions, errors };
}

function getCellValue(cell: ExcelJS.Cell): string | number | Date | null {
  const value = cell.value;
  if (value === null || value === undefined) return null;

  // Handle rich text
  if (typeof value === "object" && "richText" in value) {
    return value.richText.map((rt) => rt.text).join("");
  }

  // Handle formula results
  if (typeof value === "object" && "result" in value) {
    return value.result as string | number;
  }

  // Handle date objects
  if (value instanceof Date) {
    return value;
  }

  return value as string | number;
}

function parseAccountsSheet(
  workbook: ExcelJS.Workbook,
  errors: ImportError[]
): AccountRow[] {
  const sheet = workbook.getWorksheet("Accounts");
  if (!sheet) return [];

  const accounts: AccountRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const name = getCellValue(row.getCell(1));
    const balance = getCellValue(row.getCell(2));
    const currency = getCellValue(row.getCell(3));

    // Skip completely empty rows
    if (!name && !balance && !currency) return;

    const data = {
      name: name?.toString().trim() || "",
      balance: typeof balance === "number" ? balance : parseFloat(balance?.toString() || "0") || 0,
      currency: currency?.toString().trim() || "PYG",
    };

    const result = accountRowSchema.safeParse(data);
    if (result.success) {
      accounts.push(result.data);
    } else {
      errors.push({
        sheet: "Accounts",
        row: rowNumber,
        message: result.error.errors[0].message,
        data,
      });
    }
  });

  return accounts;
}

function parseCategoriesSheet(
  workbook: ExcelJS.Workbook,
  errors: ImportError[]
): CategoryRow[] {
  const sheet = workbook.getWorksheet("Categories");
  if (!sheet) return [];

  const categories: CategoryRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const name = getCellValue(row.getCell(1));
    const type = getCellValue(row.getCell(2));
    const color = getCellValue(row.getCell(3));
    const icon = getCellValue(row.getCell(4));

    // Skip completely empty rows
    if (!name && !type) return;

    const data = {
      name: name?.toString().trim() || "",
      type: type?.toString().trim().toUpperCase() || "",
      color: color?.toString().trim() || "#6366f1",
      icon: icon?.toString().trim() || null,
    };

    const result = categoryRowSchema.safeParse(data);
    if (result.success) {
      categories.push(result.data);
    } else {
      errors.push({
        sheet: "Categories",
        row: rowNumber,
        message: result.error.errors[0].message,
        data,
      });
    }
  });

  return categories;
}

function parseTransactionsSheet(
  workbook: ExcelJS.Workbook,
  errors: ImportError[]
): TransactionRow[] {
  const sheet = workbook.getWorksheet("Transactions");
  if (!sheet) return [];

  const transactions: TransactionRow[] = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const type = getCellValue(row.getCell(1));
    const amount = getCellValue(row.getCell(2));
    const description = getCellValue(row.getCell(3));
    const dateValue = getCellValue(row.getCell(4));
    const accountName = getCellValue(row.getCell(5));
    const categoryName = getCellValue(row.getCell(6));
    const toAccountName = getCellValue(row.getCell(7));

    // Skip completely empty rows
    if (!type && !amount && !accountName) return;

    // Parse date
    let date: Date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === "number") {
      // Excel serial date
      date = new Date((dateValue - 25569) * 86400 * 1000);
    } else if (typeof dateValue === "string") {
      date = new Date(dateValue);
    } else {
      date = new Date();
    }

    const data = {
      type: type?.toString().trim().toUpperCase() || "",
      amount:
        typeof amount === "number"
          ? amount
          : parseFloat(amount?.toString() || "0") || 0,
      description: description?.toString().trim() || null,
      date,
      accountName: accountName?.toString().trim() || "",
      categoryName: categoryName?.toString().trim() || null,
      toAccountName: toAccountName?.toString().trim() || null,
    };

    const result = transactionRowSchema.safeParse(data);
    if (result.success) {
      // Additional validation for transfers
      if (result.data.type === "TRANSFER" && !result.data.toAccountName) {
        errors.push({
          sheet: "Transactions",
          row: rowNumber,
          message: "Transfer requires a destination account (To Account)",
          data,
        });
        return;
      }
      transactions.push(result.data);
    } else {
      errors.push({
        sheet: "Transactions",
        row: rowNumber,
        message: result.error.errors[0].message,
        data,
      });
    }
  });

  return transactions;
}
