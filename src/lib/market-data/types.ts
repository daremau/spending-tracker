export type MarketAssetType = "STOCK" | "ETF" | "CRYPTO";

export type AssetSearchResult = {
  provider: "TWELVE_DATA";
  providerSymbol: string;
  symbol: string;
  name: string;
  market: string;
  type: MarketAssetType;
  quoteCurrency: string;
  country: string | null;
};

export type ProviderAssetRef = {
  assetId: string;
  providerSymbol: string;
  type: MarketAssetType;
  quoteCurrency: string;
};

export type CurrencyPair = {
  fromCurrency: string;
  toCurrency: string;
};

export type ProviderQuote = {
  assetId: string;
  providerSymbol: string;
  price: string;
  currency: string;
  asOf: Date;
};

export type ProviderExchangeRate = CurrencyPair & {
  rate: string;
  asOf: Date;
};

export type ProviderFailureCode =
  | "INVALID_RESPONSE"
  | "NOT_FOUND"
  | "UNSUPPORTED";

export type ProviderFailure = {
  key: string;
  code: ProviderFailureCode;
  message: string;
};

export type ProviderBatchResult<T> = {
  values: T[];
  failures: ProviderFailure[];
};

export interface MarketDataProvider {
  searchAssets(
    query: string,
    type?: MarketAssetType
  ): Promise<AssetSearchResult[]>;
  getQuotes(
    assets: ProviderAssetRef[]
  ): Promise<ProviderBatchResult<ProviderQuote>>;
  getExchangeRates(
    pairs: CurrencyPair[]
  ): Promise<ProviderBatchResult<ProviderExchangeRate>>;
}
