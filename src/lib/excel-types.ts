export type ImportStrategy = "skip" | "update" | "error";

export interface ImportOptions {
  accounts: ImportStrategy;
  categories: ImportStrategy;
  transactions: ImportStrategy;
}

export interface ImportStats {
  created: number;
  updated: number;
  skipped: number;
  errors: ImportError[];
}

export interface ImportResult {
  success: boolean;
  accounts: ImportStats;
  categories: ImportStats;
  transactions: ImportStats;
}

export interface ImportError {
  sheet: "Accounts" | "Categories" | "Transactions";
  row: number;
  field?: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface AccountRow {
  name: string;
  balance: number;
  currency: string;
}

export interface CategoryRow {
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
  icon: string | null;
}

export interface TransactionRow {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: number;
  description: string | null;
  date: Date;
  accountName: string;
  categoryName: string | null;
  toAccountName: string | null;
}

export interface ParsedImportData {
  accounts: AccountRow[];
  categories: CategoryRow[];
  transactions: TransactionRow[];
  errors: ImportError[];
}
