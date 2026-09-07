import ExcelJS from "exceljs";
import {
  booleanCell,
  cell,
  optionalCell,
  parseCsvSections,
  type CsvSections,
} from "./csv";
import { BACKUP_SHEETS } from "./serialize";
import { BACKUP_VERSION, emptyBackup, type BackupDataV2 } from "./types";

export type ParsedBackup = {
  backup: BackupDataV2;
  /** Version detected in the file, before any upgrade. */
  sourceVersion: 1 | 2;
  errors: string[];
};

const TRANSACTION_TYPES = new Set(["INCOME", "EXPENSE", "TRANSFER"]);
const CATEGORY_TYPES = new Set(["INCOME", "EXPENSE"]);
const ASSET_TYPES = new Set(["STOCK", "ETF", "CRYPTO"]);
const INVESTMENT_ACCOUNT_TYPES = new Set(["BROKERAGE", "EXCHANGE", "WALLET"]);
const INVESTMENT_TRANSACTION_TYPES = new Set([
  "OPENING_POSITION",
  "BUY",
  "SELL",
  "DIVIDEND",
  "FEE",
]);

function toIsoDate(value: string): string {
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? value : new Date(parsed).toISOString();
}

/**
 * Version 1 files carry no `# META` section. They are read with the same
 * section reader and then upgraded: every account becomes `STANDARD`, and
 * synthetic keys are assigned so the version 2 parent link is well-formed.
 */
function buildFromSections(sections: CsvSections): ParsedBackup {
  const backup = emptyBackup();
  const errors: string[] = [];

  const meta = sections.get("META") ?? [];
  const metaValues = new Map(
    meta.map((row) => [cell(row, 0).toLowerCase(), cell(row, 1)])
  );
  const declaredVersion = Number(metaValues.get("version") ?? "1");
  const sourceVersion: 1 | 2 = declaredVersion >= 2 ? 2 : 1;

  if (declaredVersion > BACKUP_VERSION) {
    errors.push(
      `Backup version ${declaredVersion} is newer than this application supports (${BACKUP_VERSION})`
    );
  }

  backup.settings = {
    reportingCurrency: metaValues.get("reportingcurrency") || "PYG",
    timezone: metaValues.get("timezone") || "America/Asuncion",
  };
  backup.exportedAt = metaValues.get("exportedat") || backup.exportedAt;

  for (const row of sections.get("ACCOUNTS") ?? []) {
    const name = cell(row, 0);
    if (!name) continue;
    const kind = cell(row, 3).toUpperCase();
    backup.accounts.push({
      name,
      balance: cell(row, 1) || "0",
      currency: cell(row, 2) || "PYG",
      kind: kind === "INVESTMENT_CASH" ? "INVESTMENT_CASH" : "STANDARD",
    });
  }

  for (const row of sections.get("CATEGORIES") ?? []) {
    const name = cell(row, 0);
    const type = cell(row, 1).toUpperCase();
    if (!name || !CATEGORY_TYPES.has(type)) continue;
    backup.categories.push({
      name,
      type: type as "INCOME" | "EXPENSE",
      color: cell(row, 2) || "#6366f1",
      icon: optionalCell(row, 3),
    });
  }

  (sections.get("TRANSACTIONS") ?? []).forEach((row, index) => {
    const type = cell(row, 0).toUpperCase();
    if (!TRANSACTION_TYPES.has(type)) return;
    const accountName = cell(row, 4);
    if (!accountName) return;

    backup.transactions.push({
      type: type as "INCOME" | "EXPENSE" | "TRANSFER",
      amount: cell(row, 1) || "0",
      description: optionalCell(row, 2),
      date: toIsoDate(cell(row, 3)),
      accountName,
      categoryName: optionalCell(row, 5),
      toAccountName: optionalCell(row, 6),
      isDigitalTax: booleanCell(row, 7, false),
      // Version 1 rows have no key column; a positional key keeps them unique.
      key: optionalCell(row, 8) ?? `v1-transaction-${index}`,
      parentKey: optionalCell(row, 9),
    });
  });

  for (const row of sections.get("EXCHANGE_RATES") ?? []) {
    const fromCurrency = cell(row, 0).toUpperCase();
    const toCurrency = cell(row, 1).toUpperCase();
    if (!fromCurrency || !toCurrency) continue;
    backup.exchangeRates.push({
      fromCurrency,
      toCurrency,
      rate: cell(row, 2) || "0",
      asOf: toIsoDate(cell(row, 3)),
      active: booleanCell(row, 4),
    });
  }

  for (const row of sections.get("ASSETS") ?? []) {
    const type = cell(row, 0).toUpperCase();
    const symbol = cell(row, 1);
    if (!ASSET_TYPES.has(type) || !symbol) continue;
    backup.assets.push({
      type: type as "STOCK" | "ETF" | "CRYPTO",
      symbol,
      name: cell(row, 2) || symbol,
      market: cell(row, 3) || "MANUAL",
      quoteCurrency: cell(row, 4) || "USD",
      provider: optionalCell(row, 5),
      providerSymbol: optionalCell(row, 6),
      active: booleanCell(row, 7),
    });
  }

  for (const row of sections.get("INVESTMENT_ACCOUNTS") ?? []) {
    const name = cell(row, 0);
    const type = cell(row, 1).toUpperCase();
    if (!name || !INVESTMENT_ACCOUNT_TYPES.has(type)) continue;
    backup.investmentAccounts.push({
      name,
      type: type as "BROKERAGE" | "EXCHANGE" | "WALLET",
      cashCurrency: cell(row, 2) || "USD",
      cashAccountName: cell(row, 3),
      archivedAt: optionalCell(row, 4)
        ? toIsoDate(cell(row, 4))
        : null,
    });
  }

  for (const row of sections.get("INVESTMENT_TRANSACTIONS") ?? []) {
    const clientRequestId = cell(row, 0);
    const type = cell(row, 5).toUpperCase();
    if (!clientRequestId || !INVESTMENT_TRANSACTION_TYPES.has(type)) continue;
    backup.investmentTransactions.push({
      clientRequestId,
      accountName: cell(row, 1),
      assetType: optionalCell(row, 2),
      assetSymbol: optionalCell(row, 3),
      assetMarket: optionalCell(row, 4),
      type: type as BackupDataV2["investmentTransactions"][number]["type"],
      quantity: optionalCell(row, 6),
      unitPrice: optionalCell(row, 7),
      cashAmount: optionalCell(row, 8),
      fees: cell(row, 9) || "0",
      currency: cell(row, 10) || "USD",
      fxRateToReporting: cell(row, 11) || "1",
      date: toIsoDate(cell(row, 12)),
      notes: optionalCell(row, 13),
    });
  }

  for (const row of sections.get("MANUAL_QUOTES") ?? []) {
    const symbol = cell(row, 1);
    if (!symbol) continue;
    backup.manualQuotes.push({
      assetType: cell(row, 0).toUpperCase(),
      assetSymbol: symbol,
      assetMarket: cell(row, 2),
      price: cell(row, 3) || "0",
      currency: cell(row, 4) || "USD",
      asOf: toIsoDate(cell(row, 5)),
      active: booleanCell(row, 6),
    });
  }

  if (
    backup.accounts.length === 0 &&
    backup.categories.length === 0 &&
    backup.transactions.length === 0
  ) {
    errors.push("Backup file contains no recognizable records");
  }

  return { backup, sourceVersion, errors };
}

export function parseCSV(content: string): ParsedBackup {
  return buildFromSections(parseCsvSections(content));
}

export async function parseExcel(buffer: Buffer): Promise<ParsedBackup> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  const sections: CsvSections = new Map();
  for (const sheet of BACKUP_SHEETS) {
    const worksheet = workbook.getWorksheet(sheet.name);
    const rows: string[][] = [];
    if (worksheet) {
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values: string[] = [];
        for (let index = 1; index <= sheet.columns.length; index += 1) {
          const value = row.getCell(index).value;
          values.push(
            value instanceof Date
              ? value.toISOString()
              : (row.getCell(index).text ?? "").toString().trim()
          );
        }
        // Skip rows that are entirely blank.
        if (values.some((value) => value !== "")) rows.push(values);
      });
    }
    sections.set(sheet.section, rows);
  }

  return buildFromSections(sections);
}
