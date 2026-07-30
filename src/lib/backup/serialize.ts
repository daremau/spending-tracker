import ExcelJS from "exceljs";
import { csvRow } from "./csv";
import type { BackupDataV2 } from "./types";

type SheetSpec = {
  name: string;
  section: string;
  columns: Array<{ header: string; width: number }>;
  rows: (backup: BackupDataV2) => Array<Array<string | null>>;
};

function flag(value: boolean) {
  return value ? "true" : "false";
}

/**
 * Every worksheet and CSV section is described once so the two formats cannot
 * drift apart, and so the parser can rely on a fixed column order.
 */
export const BACKUP_SHEETS: SheetSpec[] = [
  {
    name: "Meta",
    section: "META",
    columns: [
      { header: "Key", width: 20 },
      { header: "Value", width: 40 },
    ],
    rows: (backup) => [
      ["version", String(backup.version)],
      ["exportedAt", backup.exportedAt],
      ["reportingCurrency", backup.settings.reportingCurrency],
      ["timezone", backup.settings.timezone],
    ],
  },
  {
    name: "Accounts",
    section: "ACCOUNTS",
    columns: [
      { header: "Name", width: 28 },
      { header: "Balance", width: 22 },
      { header: "Currency", width: 10 },
      { header: "Kind", width: 18 },
    ],
    rows: (backup) =>
      backup.accounts.map((account) => [
        account.name,
        account.balance,
        account.currency,
        account.kind,
      ]),
  },
  {
    name: "Categories",
    section: "CATEGORIES",
    columns: [
      { header: "Name", width: 25 },
      { header: "Type", width: 12 },
      { header: "Color", width: 12 },
      { header: "Icon", width: 15 },
    ],
    rows: (backup) =>
      backup.categories.map((category) => [
        category.name,
        category.type,
        category.color,
        category.icon,
      ]),
  },
  {
    name: "Transactions",
    section: "TRANSACTIONS",
    columns: [
      { header: "Type", width: 12 },
      { header: "Amount", width: 18 },
      { header: "Description", width: 30 },
      { header: "Date", width: 26 },
      { header: "Account", width: 25 },
      { header: "Category", width: 20 },
      { header: "ToAccount", width: 25 },
      { header: "IsDigitalTax", width: 14 },
      { header: "Key", width: 28 },
      { header: "ParentKey", width: 28 },
    ],
    rows: (backup) =>
      backup.transactions.map((transaction) => [
        transaction.type,
        transaction.amount,
        transaction.description,
        transaction.date,
        transaction.accountName,
        transaction.categoryName,
        transaction.toAccountName,
        flag(transaction.isDigitalTax),
        transaction.key,
        transaction.parentKey,
      ]),
  },
  {
    name: "ExchangeRates",
    section: "EXCHANGE_RATES",
    columns: [
      { header: "FromCurrency", width: 14 },
      { header: "ToCurrency", width: 14 },
      { header: "Rate", width: 22 },
      { header: "AsOf", width: 26 },
      { header: "Active", width: 10 },
    ],
    rows: (backup) =>
      backup.exchangeRates.map((rate) => [
        rate.fromCurrency,
        rate.toCurrency,
        rate.rate,
        rate.asOf,
        flag(rate.active),
      ]),
  },
  {
    name: "Assets",
    section: "ASSETS",
    columns: [
      { header: "Type", width: 10 },
      { header: "Symbol", width: 16 },
      { header: "Name", width: 30 },
      { header: "Market", width: 14 },
      { header: "QuoteCurrency", width: 14 },
      { header: "Provider", width: 16 },
      { header: "ProviderSymbol", width: 18 },
      { header: "Active", width: 10 },
    ],
    rows: (backup) =>
      backup.assets.map((asset) => [
        asset.type,
        asset.symbol,
        asset.name,
        asset.market,
        asset.quoteCurrency,
        asset.provider,
        asset.providerSymbol,
        flag(asset.active),
      ]),
  },
  {
    name: "InvestmentAccounts",
    section: "INVESTMENT_ACCOUNTS",
    columns: [
      { header: "Name", width: 28 },
      { header: "Type", width: 14 },
      { header: "CashCurrency", width: 14 },
      { header: "CashAccount", width: 28 },
      { header: "ArchivedAt", width: 26 },
    ],
    rows: (backup) =>
      backup.investmentAccounts.map((account) => [
        account.name,
        account.type,
        account.cashCurrency,
        account.cashAccountName,
        account.archivedAt,
      ]),
  },
  {
    name: "InvestmentTransactions",
    section: "INVESTMENT_TRANSACTIONS",
    columns: [
      { header: "ClientRequestId", width: 30 },
      { header: "Account", width: 25 },
      { header: "AssetType", width: 12 },
      { header: "AssetSymbol", width: 16 },
      { header: "AssetMarket", width: 14 },
      { header: "Type", width: 18 },
      { header: "Quantity", width: 24 },
      { header: "UnitPrice", width: 20 },
      { header: "CashAmount", width: 20 },
      { header: "Fees", width: 16 },
      { header: "Currency", width: 10 },
      { header: "FxRateToReporting", width: 22 },
      { header: "Date", width: 26 },
      { header: "Notes", width: 30 },
    ],
    rows: (backup) =>
      backup.investmentTransactions.map((transaction) => [
        transaction.clientRequestId,
        transaction.accountName,
        transaction.assetType,
        transaction.assetSymbol,
        transaction.assetMarket,
        transaction.type,
        transaction.quantity,
        transaction.unitPrice,
        transaction.cashAmount,
        transaction.fees,
        transaction.currency,
        transaction.fxRateToReporting,
        transaction.date,
        transaction.notes,
      ]),
  },
  {
    name: "ManualQuotes",
    section: "MANUAL_QUOTES",
    columns: [
      { header: "AssetType", width: 12 },
      { header: "AssetSymbol", width: 16 },
      { header: "AssetMarket", width: 14 },
      { header: "Price", width: 20 },
      { header: "Currency", width: 10 },
      { header: "AsOf", width: 26 },
      { header: "Active", width: 10 },
    ],
    rows: (backup) =>
      backup.manualQuotes.map((quote) => [
        quote.assetType,
        quote.assetSymbol,
        quote.assetMarket,
        quote.price,
        quote.currency,
        quote.asOf,
        flag(quote.active),
      ]),
  },
];

export function exportToCSV(backup: BackupDataV2): string {
  const lines: string[] = [];

  for (const sheet of BACKUP_SHEETS) {
    lines.push(`# ${sheet.section}`);
    lines.push(sheet.columns.map((column) => column.header).join(","));
    for (const row of sheet.rows(backup)) {
      lines.push(csvRow(row));
    }
    lines.push("");
  }

  return lines.join("\n");
}

export async function exportToExcel(backup: BackupDataV2): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.creator = "Spending Tracker";

  for (const sheet of BACKUP_SHEETS) {
    const worksheet = workbook.addWorksheet(sheet.name);
    worksheet.columns = sheet.columns.map((column) => ({
      header: column.header,
      width: column.width,
    }));

    for (const row of sheet.rows(backup)) {
      // Values are written as text so 12-decimal quantities and 8-decimal
      // balances survive; a numeric cell would round them to a float.
      worksheet.addRow(row.map((value) => value ?? ""));
    }

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
