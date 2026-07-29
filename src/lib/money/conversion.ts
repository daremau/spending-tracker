import Decimal from "decimal.js";

const MoneyDecimal = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
});

export type MoneyInput = {
  amount: Decimal.Value;
  currency: string;
};

export type ExchangeRateInput = {
  fromCurrency: string;
  toCurrency: string;
  rate: Decimal.Value;
  active?: boolean;
  source?: "MANUAL" | "TWELVE_DATA";
};

export type ConvertedAmount =
  | {
      value: string;
      currency: string;
      complete: true;
      missingRates: [];
    }
  | {
      value: null;
      currency: string;
      complete: false;
      missingRates: string[];
    };

function normalizeCurrency(currency: string): string {
  return currency.trim().toUpperCase();
}

function pairLabel(fromCurrency: string, toCurrency: string): string {
  return `${fromCurrency} -> ${toCurrency}`;
}

function findEffectiveRate(
  rates: ExchangeRateInput[],
  fromCurrency: string,
  toCurrency: string
): ExchangeRateInput | undefined {
  const candidates = rates.filter(
    (rate) =>
      rate.active !== false &&
      normalizeCurrency(rate.fromCurrency) === fromCurrency &&
      normalizeCurrency(rate.toCurrency) === toCurrency
  );

  return (
    candidates.find((rate) => rate.source === "MANUAL") ?? candidates[0]
  );
}

export function convertAmount(
  money: MoneyInput,
  toCurrency: string,
  rates: ExchangeRateInput[]
): ConvertedAmount {
  const fromCurrency = normalizeCurrency(money.currency);
  const normalizedTarget = normalizeCurrency(toCurrency);
  const amount = new MoneyDecimal(money.amount);

  if (fromCurrency === normalizedTarget) {
    return {
      value: amount.toString(),
      currency: normalizedTarget,
      complete: true,
      missingRates: [],
    };
  }

  const exchangeRate = findEffectiveRate(
    rates,
    fromCurrency,
    normalizedTarget
  );

  if (!exchangeRate) {
    return {
      value: null,
      currency: normalizedTarget,
      complete: false,
      missingRates: [pairLabel(fromCurrency, normalizedTarget)],
    };
  }

  const rate = new MoneyDecimal(exchangeRate.rate);
  if (!rate.greaterThan(0)) {
    throw new Error(
      `Exchange rate ${pairLabel(fromCurrency, normalizedTarget)} must be positive`
    );
  }

  return {
    value: amount.times(rate).toString(),
    currency: normalizedTarget,
    complete: true,
    missingRates: [],
  };
}

export function aggregateMoney(
  amounts: MoneyInput[],
  toCurrency: string,
  rates: ExchangeRateInput[]
): ConvertedAmount {
  const normalizedTarget = normalizeCurrency(toCurrency);
  let total = new MoneyDecimal(0);
  const missingRates = new Set<string>();

  for (const amount of amounts) {
    const converted = convertAmount(amount, normalizedTarget, rates);
    if (!converted.complete) {
      converted.missingRates.forEach((pair) => missingRates.add(pair));
      continue;
    }
    total = total.plus(converted.value);
  }

  if (missingRates.size > 0) {
    return {
      value: null,
      currency: normalizedTarget,
      complete: false,
      missingRates: Array.from(missingRates).sort(),
    };
  }

  return {
    value: total.toString(),
    currency: normalizedTarget,
    complete: true,
    missingRates: [],
  };
}
