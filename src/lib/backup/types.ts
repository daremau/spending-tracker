/**
 * Backup schema version 2.
 *
 * Version 1 carried bank accounts, categories, and transactions only. Version 2
 * adds settings, manual exchange rates, the asset catalog, investment accounts,
 * investment transactions, and manual quotes.
 *
 * Every numeric field is serialized as a string. Bank balances are
 * `Decimal(24,8)` and investment quantities are `Decimal(30,12)`, both of which
 * lose digits when routed through a JavaScript number or a spreadsheet cell.
 *
 * Records are referenced by their natural keys rather than by database
 * identifiers, so a restore can rebuild the graph from scratch:
 *
 * - bank account: `name`
 * - category: `name` and `type`
 * - asset: `type`, `symbol`, and `market`
 * - investment account: `name`
 *
 * Provider-sourced quotes and exchange rates are deliberately omitted. They are
 * a reproducible cache, not user-entered data, and refetching them is cheaper
 * than carrying stale prices across a restore.
 */
export const BACKUP_VERSION = 2;

export type BackupSettings = {
  reportingCurrency: string;
  timezone: string;
};

export type BackupAccount = {
  name: string;
  balance: string;
  currency: string;
  kind: "STANDARD" | "INVESTMENT_CASH";
};

export type BackupCategory = {
  name: string;
  type: "INCOME" | "EXPENSE";
  color: string;
  icon: string | null;
};

export type BackupTransaction = {
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  description: string | null;
  date: string;
  accountName: string;
  categoryName: string | null;
  toAccountName: string | null;
  isDigitalTax: boolean;
  /** Set on a digital-tax child so the parent link survives a restore. */
  parentKey: string | null;
  /** Stable key used by children to point at this row. */
  key: string;
};

export type BackupExchangeRate = {
  fromCurrency: string;
  toCurrency: string;
  rate: string;
  asOf: string;
  active: boolean;
};

export type BackupAsset = {
  type: "STOCK" | "ETF" | "CRYPTO";
  symbol: string;
  name: string;
  market: string;
  quoteCurrency: string;
  provider: string | null;
  providerSymbol: string | null;
  active: boolean;
};

export type BackupInvestmentAccount = {
  name: string;
  type: "BROKERAGE" | "EXCHANGE" | "WALLET";
  cashCurrency: string;
  cashAccountName: string;
  archivedAt: string | null;
};

export type BackupInvestmentTransaction = {
  clientRequestId: string;
  accountName: string;
  assetType: string | null;
  assetSymbol: string | null;
  assetMarket: string | null;
  type: "OPENING_POSITION" | "BUY" | "SELL" | "DIVIDEND" | "FEE";
  quantity: string | null;
  unitPrice: string | null;
  cashAmount: string | null;
  fees: string;
  currency: string;
  fxRateToReporting: string;
  date: string;
  notes: string | null;
};

export type BackupManualQuote = {
  assetType: string;
  assetSymbol: string;
  assetMarket: string;
  price: string;
  currency: string;
  asOf: string;
  active: boolean;
};

export type BackupDataV2 = {
  version: 2;
  exportedAt: string;
  settings: BackupSettings;
  accounts: BackupAccount[];
  categories: BackupCategory[];
  transactions: BackupTransaction[];
  exchangeRates: BackupExchangeRate[];
  assets: BackupAsset[];
  investmentAccounts: BackupInvestmentAccount[];
  investmentTransactions: BackupInvestmentTransaction[];
  manualQuotes: BackupManualQuote[];
};

export function assetKey(
  type: string,
  symbol: string,
  market: string
): string {
  return `${type}|${symbol}|${market}`.toUpperCase();
}

export function emptyBackup(): BackupDataV2 {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    settings: { reportingCurrency: "PYG", timezone: "America/Asuncion" },
    accounts: [],
    categories: [],
    transactions: [],
    exchangeRates: [],
    assets: [],
    investmentAccounts: [],
    investmentTransactions: [],
    manualQuotes: [],
  };
}
