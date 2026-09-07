export type PortfolioAssetDto = {
  id: string;
  type: "STOCK" | "ETF" | "CRYPTO";
  symbol: string;
  name: string;
  market: string;
  quoteCurrency: string;
};

export type PortfolioAccountOptionDto = {
  id: string;
  name: string;
  type: "BROKERAGE" | "EXCHANGE" | "WALLET";
  cashCurrency: string;
};

export type StandardBankAccountOptionDto = {
  id: string;
  name: string;
  currency: string;
  balance: string;
};

export type InvestmentActivityDto = {
  id: string;
  clientRequestId: string;
  type: "OPENING_POSITION" | "BUY" | "SELL" | "DIVIDEND" | "FEE";
  assetId: string | null;
  assetSymbol: string | null;
  quantity: string | null;
  unitPrice: string | null;
  cashAmount: string | null;
  fees: string;
  currency: string;
  fxRateToReporting: string;
  date: string;
  notes: string | null;
};

export type PortfolioTransferActivityDto = {
  id: string;
  type: "FUNDING" | "WITHDRAWAL";
  amount: string;
  currency: string;
  bankAccountName: string;
  date: string;
  notes: string | null;
};

export type PortfolioPositionDto = {
  accountId: string;
  asset: PortfolioAssetDto;
  quantity: string;
  averageCostNative: string;
  remainingCostNative: string;
  remainingCostReporting: string;
  quote: {
    price: string | null;
    source:
      | "MANUAL"
      | "PROVIDER"
      | "TRANSACTION_FALLBACK"
      | "UNAVAILABLE";
    freshness: "MANUAL" | "FRESH" | "STALE" | "FALLBACK" | "UNAVAILABLE";
    asOf: string | null;
    fetchedAt: string | null;
    manualQuoteId: string | null;
  };
  marketValueNative: string | null;
  marketValueReporting: string | null;
  unrealizedGainNative: string | null;
  unrealizedGainReporting: string | null;
  reportingComplete: boolean;
  missingRates: string[];
};

export type PortfolioClosedPositionDto = {
  accountId: string;
  accountName: string;
  asset: PortfolioAssetDto;
  realizedGainNative: string;
  realizedGainReporting: string;
  dividendsNative: string;
  dividendsReporting: string;
  feesNative: string;
  feesReporting: string;
  lastActivityDate: string;
};

export type PortfolioAllocationSliceDto = {
  key: string;
  label: string;
  sublabel: string;
  value: string;
  share: number;
  color: string;
};

export type PortfolioAllocationDto = {
  /** Slices only cover positions whose reporting value is complete. */
  slices: PortfolioAllocationSliceDto[];
  /** Symbols excluded because a quote or rate is missing. */
  excludedSymbols: string[];
};

export type PortfolioAccountSummaryDto = PortfolioAccountOptionDto & {
  archivedAt: string | null;
  cashBalance: string;
  positionCount: number;
  holdingsValueNative: string | null;
  totalValueNative: string | null;
  totalValueReporting: string | null;
  realizedGainNative: string;
  realizedGainReporting: string;
  dividendsNative: string;
  dividendsReporting: string;
  feesNative: string;
  feesReporting: string;
  reportingCurrency: string;
  complete: boolean;
  missingRates: string[];
  missingQuotes: string[];
  positions: PortfolioPositionDto[];
  closedPositions: PortfolioClosedPositionDto[];
};

export type PortfolioOverviewDto = {
  reportingCurrency: string;
  totalValueReporting: string | null;
  cashValueReporting: string | null;
  holdingsValueReporting: string | null;
  costBasisReporting: string;
  unrealizedGainReporting: string | null;
  realizedGainReporting: string;
  dividendsReporting: string;
  feesReporting: string;
  complete: boolean;
  missingRates: string[];
  missingQuotes: string[];
  accounts: PortfolioAccountSummaryDto[];
  assets: PortfolioAssetDto[];
  closedPositions: PortfolioClosedPositionDto[];
  positionAllocation: PortfolioAllocationDto;
  assetTypeAllocation: PortfolioAllocationDto;
};

export type NetWorthSummaryDto = {
  reportingCurrency: string;
  bankCashReporting: string | null;
  investmentCashReporting: string | null;
  holdingsValueReporting: string | null;
  investmentValueReporting: string | null;
  netWorthReporting: string | null;
  complete: boolean;
  missingRates: string[];
  missingQuotes: string[];
  hasInvestments: boolean;
};

export type InvestmentAccountDetailDto = {
  account: PortfolioAccountSummaryDto;
  activities: InvestmentActivityDto[];
  fundingActivities: PortfolioTransferActivityDto[];
  assets: PortfolioAssetDto[];
  standardAccounts: StandardBankAccountOptionDto[];
};
