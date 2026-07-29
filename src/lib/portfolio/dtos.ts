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

export type PortfolioPositionDto = {
  accountId: string;
  asset: PortfolioAssetDto;
  quantity: string;
  averageCostNative: string;
  remainingCostNative: string;
  remainingCostReporting: string;
  quote: {
    price: string | null;
    source: "MANUAL" | "FALLBACK" | "UNAVAILABLE";
    asOf: string | null;
    manualQuoteId: string | null;
  };
  marketValueNative: string | null;
  marketValueReporting: string | null;
  unrealizedGainNative: string | null;
  unrealizedGainReporting: string | null;
  reportingComplete: boolean;
  missingRates: string[];
};

export type PortfolioAccountSummaryDto = PortfolioAccountOptionDto & {
  archivedAt: string | null;
  cashBalance: string;
  positionCount: number;
  holdingsValueNative: string | null;
  totalValueNative: string | null;
  totalValueReporting: string | null;
  reportingCurrency: string;
  complete: boolean;
  missingRates: string[];
  missingQuotes: string[];
  positions: PortfolioPositionDto[];
};

export type PortfolioOverviewDto = {
  reportingCurrency: string;
  totalValueReporting: string | null;
  cashValueReporting: string | null;
  holdingsValueReporting: string | null;
  costBasisReporting: string;
  complete: boolean;
  missingRates: string[];
  missingQuotes: string[];
  accounts: PortfolioAccountSummaryDto[];
  assets: PortfolioAssetDto[];
};

export type InvestmentAccountDetailDto = {
  account: PortfolioAccountSummaryDto;
  activities: InvestmentActivityDto[];
  assets: PortfolioAssetDto[];
};
