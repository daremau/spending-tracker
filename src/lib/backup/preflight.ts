import Decimal from "decimal.js";
import {
  calculateTransactionCashEffect,
  replayLedger,
  type LedgerTransactionInput,
} from "@/lib/portfolio/calculations";
import { assetKey, type BackupDataV2 } from "./types";

const BackupDecimal = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
});

/** Cash-balance drift tolerated before a restore is rejected. */
const CASH_TOLERANCE = "0.00000001";

export type PreflightResult = {
  ok: boolean;
  errors: string[];
};

function isFiniteDecimal(value: string | null | undefined): boolean {
  if (value === null || value === undefined || value.trim() === "") return false;
  try {
    return new BackupDecimal(value).isFinite();
  } catch {
    return false;
  }
}

function isValidDate(value: string | null | undefined): boolean {
  if (!value) return false;
  return !Number.isNaN(Date.parse(value));
}

/**
 * Validates a parsed backup completely before any data is deleted.
 *
 * A restore replaces everything, so a partially valid file is worse than a
 * rejected one: every reference, invariant, and number is checked here and the
 * caller only proceeds on `ok`.
 */
export function preflightBackup(backup: BackupDataV2): PreflightResult {
  const errors: string[] = [];

  if (backup.version !== 2) {
    errors.push(`Unsupported backup version ${backup.version}`);
  }
  if (!backup.settings.reportingCurrency) {
    errors.push("Reporting currency is missing");
  }

  // --- Identity uniqueness -------------------------------------------------
  const accountNames = new Set<string>();
  for (const account of backup.accounts) {
    const key = account.name.trim().toLowerCase();
    if (!key) {
      errors.push("A bank account has an empty name");
      continue;
    }
    if (accountNames.has(key)) {
      errors.push(`Duplicate bank account name "${account.name}"`);
    }
    accountNames.add(key);
    if (!isFiniteDecimal(account.balance)) {
      errors.push(`Bank account "${account.name}" has an invalid balance`);
    }
    if (!account.currency) {
      errors.push(`Bank account "${account.name}" has no currency`);
    }
  }

  const categoryKeys = new Set<string>();
  for (const category of backup.categories) {
    const key = `${category.name.trim().toLowerCase()}:${category.type}`;
    if (categoryKeys.has(key)) {
      errors.push(`Duplicate category "${category.name}" (${category.type})`);
    }
    categoryKeys.add(key);
  }

  const assetKeys = new Set<string>();
  for (const asset of backup.assets) {
    const key = assetKey(asset.type, asset.symbol, asset.market);
    if (assetKeys.has(key)) {
      errors.push(`Duplicate asset ${asset.symbol} on ${asset.market}`);
    }
    assetKeys.add(key);
  }

  const investmentAccountNames = new Set<string>();
  const cashAccountUsage = new Map<string, string>();
  for (const account of backup.investmentAccounts) {
    const key = account.name.trim().toLowerCase();
    if (investmentAccountNames.has(key)) {
      errors.push(`Duplicate investment account name "${account.name}"`);
    }
    investmentAccountNames.add(key);

    const cashKey = account.cashAccountName.trim().toLowerCase();
    if (!accountNames.has(cashKey)) {
      errors.push(
        `Investment account "${account.name}" references missing cash account "${account.cashAccountName}"`
      );
      continue;
    }
    const cashAccount = backup.accounts.find(
      (candidate) => candidate.name.trim().toLowerCase() === cashKey
    );
    if (cashAccount && cashAccount.kind !== "INVESTMENT_CASH") {
      errors.push(
        `Cash account "${account.cashAccountName}" must be an INVESTMENT_CASH account`
      );
    }
    if (cashAccount && cashAccount.currency !== account.cashCurrency) {
      errors.push(
        `Investment account "${account.name}" currency ${account.cashCurrency} does not match its cash account ${cashAccount.currency}`
      );
    }
    const previous = cashAccountUsage.get(cashKey);
    if (previous) {
      errors.push(
        `Cash account "${account.cashAccountName}" is claimed by both "${previous}" and "${account.name}"`
      );
    }
    cashAccountUsage.set(cashKey, account.name);
  }

  // --- Bank transaction references ----------------------------------------
  const transactionKeys = new Set<string>();
  for (const transaction of backup.transactions) {
    if (transactionKeys.has(transaction.key)) {
      errors.push(`Duplicate transaction key "${transaction.key}"`);
    }
    transactionKeys.add(transaction.key);

    if (!accountNames.has(transaction.accountName.trim().toLowerCase())) {
      errors.push(
        `Transaction references missing account "${transaction.accountName}"`
      );
    }
    if (
      transaction.toAccountName &&
      !accountNames.has(transaction.toAccountName.trim().toLowerCase())
    ) {
      errors.push(
        `Transfer references missing destination account "${transaction.toAccountName}"`
      );
    }
    if (
      transaction.categoryName &&
      !categoryKeys.has(
        `${transaction.categoryName.trim().toLowerCase()}:${
          transaction.type === "INCOME" ? "INCOME" : "EXPENSE"
        }`
      )
    ) {
      errors.push(
        `Transaction references missing category "${transaction.categoryName}"`
      );
    }
    if (!isFiniteDecimal(transaction.amount)) {
      errors.push(`Transaction "${transaction.key}" has an invalid amount`);
    }
    if (!isValidDate(transaction.date)) {
      errors.push(`Transaction "${transaction.key}" has an invalid date`);
    }
    if (transaction.type === "TRANSFER" && !transaction.toAccountName) {
      errors.push(
        `Transfer "${transaction.key}" has no destination account`
      );
    }
  }

  for (const transaction of backup.transactions) {
    if (transaction.parentKey && !transactionKeys.has(transaction.parentKey)) {
      errors.push(
        `Digital tax transaction "${transaction.key}" references missing parent "${transaction.parentKey}"`
      );
    }
  }

  // --- Investment transaction references ----------------------------------
  const clientRequestIds = new Set<string>();
  for (const transaction of backup.investmentTransactions) {
    if (clientRequestIds.has(transaction.clientRequestId)) {
      errors.push(
        `Duplicate investment transaction id "${transaction.clientRequestId}"`
      );
    }
    clientRequestIds.add(transaction.clientRequestId);

    if (
      !investmentAccountNames.has(transaction.accountName.trim().toLowerCase())
    ) {
      errors.push(
        `Investment transaction "${transaction.clientRequestId}" references missing account "${transaction.accountName}"`
      );
    }
    if (transaction.assetSymbol) {
      const key = assetKey(
        transaction.assetType ?? "",
        transaction.assetSymbol,
        transaction.assetMarket ?? ""
      );
      if (!assetKeys.has(key)) {
        errors.push(
          `Investment transaction "${transaction.clientRequestId}" references missing asset ${transaction.assetSymbol}`
        );
      }
    } else if (transaction.type !== "FEE") {
      errors.push(
        `Investment transaction "${transaction.clientRequestId}" of type ${transaction.type} needs an asset`
      );
    }
    if (!isValidDate(transaction.date)) {
      errors.push(
        `Investment transaction "${transaction.clientRequestId}" has an invalid date`
      );
    }
    if (!isFiniteDecimal(transaction.fxRateToReporting)) {
      errors.push(
        `Investment transaction "${transaction.clientRequestId}" has an invalid FX rate`
      );
    }
  }

  for (const quote of backup.manualQuotes) {
    const key = assetKey(quote.assetType, quote.assetSymbol, quote.assetMarket);
    if (!assetKeys.has(key)) {
      errors.push(`Manual quote references missing asset ${quote.assetSymbol}`);
    }
    if (!isFiniteDecimal(quote.price)) {
      errors.push(`Manual quote for ${quote.assetSymbol} has an invalid price`);
    }
  }

  for (const rate of backup.exchangeRates) {
    if (!isFiniteDecimal(rate.rate) || new BackupDecimal(rate.rate).lte(0)) {
      errors.push(
        `Exchange rate ${rate.fromCurrency} -> ${rate.toCurrency} must be positive`
      );
    }
  }

  // Structural problems make the replay below meaningless, so stop here.
  if (errors.length > 0) return { ok: false, errors };

  errors.push(...replayInvestmentLedgers(backup));
  errors.push(...checkLinkedCashConsistency(backup));

  return { ok: errors.length === 0, errors };
}

function toLedgerInput(
  transaction: BackupDataV2["investmentTransactions"][number],
  index: number
): LedgerTransactionInput {
  return {
    id: transaction.clientRequestId,
    type: transaction.type,
    quantity: transaction.quantity,
    unitPrice: transaction.unitPrice,
    cashAmount: transaction.cashAmount,
    fees: transaction.fees,
    fxRateToReporting: transaction.fxRateToReporting,
    date: new Date(transaction.date),
    // Ordering inside a day follows file order, which mirrors the export order.
    createdAt: new Date(Date.parse(transaction.date) + index),
  };
}

/** Replays every account/asset ledger so an oversold history is rejected. */
function replayInvestmentLedgers(backup: BackupDataV2): string[] {
  const errors: string[] = [];
  const groups = new Map<
    string,
    Array<{ transaction: BackupDataV2["investmentTransactions"][number]; index: number }>
  >();

  backup.investmentTransactions.forEach((transaction, index) => {
    if (!transaction.assetSymbol) return;
    const key = `${transaction.accountName.trim().toLowerCase()}::${assetKey(
      transaction.assetType ?? "",
      transaction.assetSymbol,
      transaction.assetMarket ?? ""
    )}`;
    const current = groups.get(key) ?? [];
    current.push({ transaction, index });
    groups.set(key, current);
  });

  for (const [key, entries] of groups) {
    try {
      replayLedger(
        entries.map((entry) => toLedgerInput(entry.transaction, entry.index))
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "invalid ledger";
      errors.push(`Ledger ${key.replace("::", " / ")} is invalid: ${message}`);
    }
  }

  return errors;
}

/**
 * Confirms each investment cash balance equals its funding transfers plus the
 * cash effect of its investment transactions, so a restore cannot commit a
 * ledger that disagrees with the balance it claims.
 */
function checkLinkedCashConsistency(backup: BackupDataV2): string[] {
  const errors: string[] = [];

  for (const investmentAccount of backup.investmentAccounts) {
    const cashName = investmentAccount.cashAccountName.trim().toLowerCase();
    const cashAccount = backup.accounts.find(
      (account) => account.name.trim().toLowerCase() === cashName
    );
    if (!cashAccount) continue;

    let expected = new BackupDecimal(0);
    for (const transaction of backup.transactions) {
      if (transaction.type !== "TRANSFER") continue;
      if (transaction.toAccountName?.trim().toLowerCase() === cashName) {
        expected = expected.plus(transaction.amount);
      }
      if (transaction.accountName.trim().toLowerCase() === cashName) {
        expected = expected.minus(transaction.amount);
      }
    }

    const accountName = investmentAccount.name.trim().toLowerCase();
    for (const transaction of backup.investmentTransactions) {
      if (transaction.accountName.trim().toLowerCase() !== accountName) continue;
      expected = expected.plus(
        calculateTransactionCashEffect({
          id: transaction.clientRequestId,
          type: transaction.type,
          quantity: transaction.quantity,
          unitPrice: transaction.unitPrice,
          cashAmount: transaction.cashAmount,
          fees: transaction.fees,
        })
      );
    }

    const actual = new BackupDecimal(cashAccount.balance);
    if (actual.minus(expected).abs().greaterThan(CASH_TOLERANCE)) {
      errors.push(
        `Investment cash for "${investmentAccount.name}" is ${actual.toString()} but its ledger implies ${expected.toString()}`
      );
    }
  }

  return errors;
}
