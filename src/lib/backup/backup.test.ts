import { describe, expect, it } from "vitest";
import { parseCsvLine, parseCsvSections } from "./csv";
import { parseCSV, parseExcel } from "./parse";
import { preflightBackup } from "./preflight";
import { exportToCSV, exportToExcel } from "./serialize";
import { BACKUP_VERSION, emptyBackup, type BackupDataV2 } from "./types";

/**
 * A complete fixture: PYG reporting, one standard account, one investment cash
 * account funded from it, a stock buy, a partial sell, a dividend, a manual
 * quote, a manual FX rate, and an IVA Digital parent/child pair.
 */
function fixture(): BackupDataV2 {
  const backup = emptyBackup();
  backup.exportedAt = "2026-07-30T00:00:00.000Z";
  backup.settings = {
    reportingCurrency: "PYG",
    timezone: "America/Asuncion",
  };

  backup.accounts = [
    { name: "Main PYG", balance: "21900000", currency: "PYG", kind: "STANDARD" },
    {
      name: "IBKR cash",
      balance: "1183.00000000",
      currency: "USD",
      kind: "INVESTMENT_CASH",
    },
  ];

  backup.categories = [
    { name: "Salary", type: "INCOME", color: "#16a34a", icon: null },
    { name: 'Food, "dining"', type: "EXPENSE", color: "#dc2626", icon: "utensils" },
  ];

  backup.transactions = [
    {
      key: "t1",
      type: "EXPENSE",
      amount: "50000",
      description: 'Lunch with a comma, and a "quote"',
      date: "2026-06-01T00:00:00.000Z",
      accountName: "Main PYG",
      categoryName: 'Food, "dining"',
      toAccountName: null,
      isDigitalTax: false,
      parentKey: null,
    },
    {
      key: "t2",
      type: "EXPENSE",
      amount: "5000",
      description: "IVA Digital",
      date: "2026-06-01T00:00:00.000Z",
      accountName: "Main PYG",
      categoryName: 'Food, "dining"',
      toAccountName: null,
      isDigitalTax: true,
      parentKey: "t1",
    },
    {
      key: "t3",
      type: "TRANSFER",
      amount: "2000",
      description: "Fund IBKR",
      date: "2026-03-01T00:00:00.000Z",
      accountName: "Main PYG",
      categoryName: null,
      toAccountName: "IBKR cash",
      isDigitalTax: false,
      parentKey: null,
    },
  ];

  backup.exchangeRates = [
    {
      fromCurrency: "USD",
      toCurrency: "PYG",
      rate: "7300.0000000000",
      asOf: "2026-07-01T00:00:00.000Z",
      active: true,
    },
  ];

  backup.assets = [
    {
      type: "STOCK",
      symbol: "AAPL",
      name: "Apple Inc.",
      market: "NASDAQ",
      quoteCurrency: "USD",
      provider: "twelve-data",
      providerSymbol: "AAPL",
      active: true,
    },
    {
      type: "CRYPTO",
      symbol: "BTC/USD",
      name: "Bitcoin",
      market: "CRYPTO",
      quoteCurrency: "USD",
      provider: null,
      providerSymbol: null,
      active: true,
    },
  ];

  backup.investmentAccounts = [
    {
      name: "IBKR",
      type: "BROKERAGE",
      cashCurrency: "USD",
      cashAccountName: "IBKR cash",
      archivedAt: null,
    },
  ];

  backup.investmentTransactions = [
    {
      clientRequestId: "iv-1",
      accountName: "IBKR",
      assetType: "STOCK",
      assetSymbol: "AAPL",
      assetMarket: "NASDAQ",
      type: "BUY",
      quantity: "10.000000000000",
      unitPrice: "100.00000000",
      cashAmount: null,
      fees: "0",
      currency: "USD",
      fxRateToReporting: "7300.0000000000",
      date: "2026-03-02T00:00:00.000Z",
      notes: null,
    },
    {
      clientRequestId: "iv-2",
      accountName: "IBKR",
      assetType: "STOCK",
      assetSymbol: "AAPL",
      assetMarket: "NASDAQ",
      type: "SELL",
      quantity: "1.000000000000",
      unitPrice: "150.00000000",
      cashAmount: null,
      fees: "0",
      currency: "USD",
      fxRateToReporting: "7300.0000000000",
      date: "2026-04-02T00:00:00.000Z",
      notes: "Trim",
    },
    {
      clientRequestId: "iv-3",
      accountName: "IBKR",
      assetType: "CRYPTO",
      assetSymbol: "BTC/USD",
      assetMarket: "CRYPTO",
      type: "OPENING_POSITION",
      quantity: "0.000000012345",
      unitPrice: "60000.00000000",
      cashAmount: null,
      fees: "0",
      currency: "USD",
      fxRateToReporting: "7300.0000000000",
      date: "2026-02-01T00:00:00.000Z",
      notes: null,
    },
    {
      clientRequestId: "iv-4",
      accountName: "IBKR",
      assetType: "STOCK",
      assetSymbol: "AAPL",
      assetMarket: "NASDAQ",
      type: "DIVIDEND",
      quantity: null,
      unitPrice: null,
      cashAmount: "33.00000000",
      fees: "0",
      currency: "USD",
      fxRateToReporting: "7300.0000000000",
      date: "2026-05-02T00:00:00.000Z",
      notes: null,
    },
  ];

  backup.manualQuotes = [
    {
      assetType: "STOCK",
      assetSymbol: "AAPL",
      assetMarket: "NASDAQ",
      price: "110.00000000",
      currency: "USD",
      asOf: "2026-07-29T00:00:00.000Z",
      active: true,
    },
  ];

  return backup;
}

describe("csv helpers", () => {
  it("round-trips commas, quotes, and empty fields", () => {
    expect(parseCsvLine('"a,b","say ""hi""","",plain')).toEqual([
      "a,b",
      'say "hi"',
      "",
      "plain",
    ]);
  });

  it("splits sections and drops each header row", () => {
    const sections = parseCsvSections(
      ['# ACCOUNTS', "Name,Balance", '"A","1"', "", "# CATEGORIES", "Name,Type", '"C","INCOME"'].join(
        "\n"
      )
    );

    expect(sections.get("ACCOUNTS")).toEqual([["A", "1"]]);
    expect(sections.get("CATEGORIES")).toEqual([["C", "INCOME"]]);
  });
});

describe("version 2 CSV round trip", () => {
  it("reproduces every section", () => {
    const original = fixture();
    const { backup, sourceVersion, errors } = parseCSV(exportToCSV(original));

    expect(errors).toEqual([]);
    expect(sourceVersion).toBe(2);
    expect(backup.version).toBe(BACKUP_VERSION);
    expect(backup.settings).toEqual(original.settings);
    expect(backup.accounts).toEqual(original.accounts);
    expect(backup.categories).toEqual(original.categories);
    expect(backup.transactions).toEqual(original.transactions);
    expect(backup.exchangeRates).toEqual(original.exchangeRates);
    expect(backup.assets).toEqual(original.assets);
    expect(backup.investmentAccounts).toEqual(original.investmentAccounts);
    expect(backup.investmentTransactions).toEqual(
      original.investmentTransactions
    );
    expect(backup.manualQuotes).toEqual(original.manualQuotes);
  });

  it("preserves twelve-decimal quantities and eight-decimal balances", () => {
    const { backup } = parseCSV(exportToCSV(fixture()));

    expect(
      backup.investmentTransactions.find((t) => t.clientRequestId === "iv-3")
        ?.quantity
    ).toBe("0.000000012345");
    expect(
      backup.accounts.find((a) => a.name === "IBKR cash")?.balance
    ).toBe("1183.00000000");
  });

  it("keeps the digital-tax parent link", () => {
    const { backup } = parseCSV(exportToCSV(fixture()));
    const child = backup.transactions.find((t) => t.key === "t2");

    expect(child?.isDigitalTax).toBe(true);
    expect(child?.parentKey).toBe("t1");
  });

  it("contains no provider secret", () => {
    const csv = exportToCSV(fixture());

    expect(csv).not.toMatch(/API_KEY|SECRET|BEARER|TWELVE_DATA_API/i);
    // The asset's provider name is data, not a credential.
    expect(csv).toContain("twelve-data");
  });
});

describe("version 2 Excel round trip", () => {
  it("reproduces every section", async () => {
    const original = fixture();
    const { backup, errors, sourceVersion } = await parseExcel(
      await exportToExcel(original)
    );

    expect(errors).toEqual([]);
    expect(sourceVersion).toBe(2);
    expect(backup.accounts).toEqual(original.accounts);
    expect(backup.transactions).toEqual(original.transactions);
    expect(backup.investmentTransactions).toEqual(
      original.investmentTransactions
    );
    expect(backup.manualQuotes).toEqual(original.manualQuotes);
  });

  it("preserves high-precision quantities through spreadsheet cells", async () => {
    const { backup } = await parseExcel(await exportToExcel(fixture()));

    expect(
      backup.investmentTransactions.find((t) => t.clientRequestId === "iv-3")
        ?.quantity
    ).toBe("0.000000012345");
  });
});

describe("version 1 compatibility", () => {
  const v1 = [
    "# ACCOUNTS",
    "Name,Balance,Currency",
    '"Cash",1500.5,"PYG"',
    "",
    "# CATEGORIES",
    "Name,Type,Color,Icon",
    '"Salary","INCOME","#16a34a",""',
    "",
    "# TRANSACTIONS",
    "Type,Amount,Description,Date,Account,Category,ToAccount",
    '"INCOME",1000,"Pay",2026-01-15,"Cash","Salary",""',
  ].join("\n");

  it("reads a version 1 file and upgrades it", () => {
    const { backup, sourceVersion, errors } = parseCSV(v1);

    expect(errors).toEqual([]);
    expect(sourceVersion).toBe(1);
    expect(backup.version).toBe(2);
    expect(backup.accounts).toEqual([
      { name: "Cash", balance: "1500.5", currency: "PYG", kind: "STANDARD" },
    ]);
    expect(backup.transactions).toHaveLength(1);
    expect(backup.transactions[0].accountName).toBe("Cash");
    expect(backup.transactions[0].isDigitalTax).toBe(false);
    expect(backup.transactions[0].key).toBe("v1-transaction-0");
  });

  it("passes preflight after the upgrade", () => {
    const { backup } = parseCSV(v1);

    expect(preflightBackup(backup)).toEqual({ ok: true, errors: [] });
  });

  it("rejects a file with no recognizable records", () => {
    expect(parseCSV("nothing here").errors).toEqual([
      "Backup file contains no recognizable records",
    ]);
  });
});

describe("preflightBackup", () => {
  it("accepts the complete fixture", () => {
    expect(preflightBackup(fixture())).toEqual({ ok: true, errors: [] });
  });

  it("rejects a transaction pointing at a missing account", () => {
    const backup = fixture();
    backup.transactions[0].accountName = "Ghost";

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'Transaction references missing account "Ghost"'
    );
  });

  it("rejects an investment transaction pointing at a missing asset", () => {
    const backup = fixture();
    backup.investmentTransactions[0].assetSymbol = "TSLA";

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("missing asset TSLA"))).toBe(
      true
    );
  });

  it("rejects a manual quote pointing at a missing asset", () => {
    const backup = fixture();
    backup.manualQuotes[0].assetSymbol = "NVDA";

    expect(preflightBackup(backup).ok).toBe(false);
  });

  it("rejects an oversold ledger", () => {
    const backup = fixture();
    // Sell 20 of a 10-unit position.
    backup.investmentTransactions[1].quantity = "20.000000000000";
    // Keep the cash balance consistent so the oversell is the only failure.
    backup.accounts[1].balance = "1000000";

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("is invalid"))).toBe(true);
  });

  it("rejects investment cash that disagrees with its ledger", () => {
    const backup = fixture();
    backup.accounts[1].balance = "999999";

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("its ledger implies"))
    ).toBe(true);
  });

  it("rejects duplicate bank account names", () => {
    const backup = fixture();
    backup.accounts.push({ ...backup.accounts[0] });

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('Duplicate bank account name "Main PYG"');
  });

  it("rejects an investment account whose cash account is STANDARD", () => {
    const backup = fixture();
    backup.accounts[1].kind = "STANDARD";

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("must be an INVESTMENT_CASH"))
    ).toBe(true);
  });

  it("rejects two investment accounts claiming one cash account", () => {
    const backup = fixture();
    backup.investmentAccounts.push({
      ...backup.investmentAccounts[0],
      name: "IBKR Two",
    });

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes("is claimed by both"))).toBe(
      true
    );
  });

  it("rejects a digital-tax child with a missing parent", () => {
    const backup = fixture();
    backup.transactions[1].parentKey = "nope";

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("missing parent"))
    ).toBe(true);
  });

  it("rejects a non-positive exchange rate", () => {
    const backup = fixture();
    backup.exchangeRates[0].rate = "0";

    expect(preflightBackup(backup).ok).toBe(false);
  });

  it("rejects an unsupported version", () => {
    const backup = { ...fixture(), version: 3 as unknown as 2 };

    expect(preflightBackup(backup).errors).toContain(
      "Unsupported backup version 3"
    );
  });

  it("rejects a transfer with no destination", () => {
    const backup = fixture();
    backup.transactions[2].toAccountName = null;

    const result = preflightBackup(backup);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) => error.includes("no destination account"))
    ).toBe(true);
  });

  it("accepts an empty backup", () => {
    expect(preflightBackup(emptyBackup()).ok).toBe(true);
  });
});
