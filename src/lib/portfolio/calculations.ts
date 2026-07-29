import Decimal from "decimal.js";

const PortfolioDecimal = Decimal.clone({
  precision: 50,
  rounding: Decimal.ROUND_HALF_UP,
});

export type LedgerTransactionType =
  | "OPENING_POSITION"
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "FEE";

export type LedgerTransactionInput = {
  id: string;
  type: LedgerTransactionType;
  quantity?: Decimal.Value | null;
  unitPrice?: Decimal.Value | null;
  cashAmount?: Decimal.Value | null;
  fees?: Decimal.Value | null;
  fxRateToReporting: Decimal.Value;
  date: Date | string;
  createdAt: Date | string;
};

export type PositionState = {
  quantity: string;
  remainingCostNative: string;
  remainingCostReporting: string;
  averageCostNative: string;
  realizedGainNative: string;
  realizedGainReporting: string;
  dividendsNative: string;
  dividendsReporting: string;
  feesNative: string;
  feesReporting: string;
  cashEffect: string;
};

export type CashEffectInput = Pick<
  LedgerTransactionInput,
  "id" | "type" | "quantity" | "unitPrice" | "cashAmount" | "fees"
>;

function requiredPositive(
  value: Decimal.Value | null | undefined,
  field: string,
  transactionId: string
) {
  if (value === null || value === undefined) {
    throw new Error(`${field} is required for transaction ${transactionId}`);
  }
  const decimal = new PortfolioDecimal(value);
  if (!decimal.greaterThan(0)) {
    throw new Error(`${field} must be positive for transaction ${transactionId}`);
  }
  return decimal;
}

function nonNegative(
  value: Decimal.Value | null | undefined,
  field: string,
  transactionId: string
) {
  const decimal = new PortfolioDecimal(value ?? 0);
  if (decimal.isNegative()) {
    throw new Error(`${field} cannot be negative for transaction ${transactionId}`);
  }
  return decimal;
}

export function calculateTransactionCashEffect(
  transaction: CashEffectInput
): string {
  const fees = nonNegative(transaction.fees, "fees", transaction.id);

  if (transaction.type === "OPENING_POSITION") return "0";

  if (transaction.type === "BUY" || transaction.type === "SELL") {
    const quantity = requiredPositive(
      transaction.quantity,
      "quantity",
      transaction.id
    );
    const unitPrice = requiredPositive(
      transaction.unitPrice,
      "unitPrice",
      transaction.id
    );
    const gross = quantity.times(unitPrice);
    return transaction.type === "BUY"
      ? gross.plus(fees).negated().toString()
      : gross.minus(fees).toString();
  }

  const amount = requiredPositive(
    transaction.cashAmount,
    "cashAmount",
    transaction.id
  );
  return transaction.type === "DIVIDEND"
    ? amount.minus(fees).toString()
    : amount.negated().toString();
}

export function calculateCashAdjustment(
  original: CashEffectInput | null,
  proposed: CashEffectInput | null
): string {
  const originalEffect = original
    ? new PortfolioDecimal(calculateTransactionCashEffect(original))
    : new PortfolioDecimal(0);
  const proposedEffect = proposed
    ? new PortfolioDecimal(calculateTransactionCashEffect(proposed))
    : new PortfolioDecimal(0);
  return proposedEffect.minus(originalEffect).toString();
}

function stableSort(transactions: LedgerTransactionInput[]) {
  return [...transactions].sort((left, right) => {
    const dateDifference =
      new Date(left.date).getTime() - new Date(right.date).getTime();
    if (dateDifference !== 0) return dateDifference;

    const createdDifference =
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (createdDifference !== 0) return createdDifference;
    return left.id.localeCompare(right.id);
  });
}

export function replayLedger(
  transactions: LedgerTransactionInput[]
): PositionState {
  let quantity = new PortfolioDecimal(0);
  let remainingCostNative = new PortfolioDecimal(0);
  let remainingCostReporting = new PortfolioDecimal(0);
  let realizedGainNative = new PortfolioDecimal(0);
  let realizedGainReporting = new PortfolioDecimal(0);
  let dividendsNative = new PortfolioDecimal(0);
  let dividendsReporting = new PortfolioDecimal(0);
  let feesNative = new PortfolioDecimal(0);
  let feesReporting = new PortfolioDecimal(0);
  let cashEffect = new PortfolioDecimal(0);

  for (const transaction of stableSort(transactions)) {
    const fxRate = requiredPositive(
      transaction.fxRateToReporting,
      "fxRateToReporting",
      transaction.id
    );
    const fees = nonNegative(transaction.fees, "fees", transaction.id);

    if (
      transaction.type === "OPENING_POSITION" ||
      transaction.type === "BUY"
    ) {
      const addedQuantity = requiredPositive(
        transaction.quantity,
        "quantity",
        transaction.id
      );
      const unitPrice = requiredPositive(
        transaction.unitPrice,
        "unitPrice",
        transaction.id
      );
      const gross = addedQuantity.times(unitPrice);
      const addedCost = gross.plus(fees);

      quantity = quantity.plus(addedQuantity);
      remainingCostNative = remainingCostNative.plus(addedCost);
      remainingCostReporting = remainingCostReporting.plus(
        addedCost.times(fxRate)
      );
      feesNative = feesNative.plus(fees);
      feesReporting = feesReporting.plus(fees.times(fxRate));

      if (transaction.type === "BUY") {
        cashEffect = cashEffect.plus(
          calculateTransactionCashEffect(transaction)
        );
      }
      continue;
    }

    if (transaction.type === "SELL") {
      const soldQuantity = requiredPositive(
        transaction.quantity,
        "quantity",
        transaction.id
      );
      const unitPrice = requiredPositive(
        transaction.unitPrice,
        "unitPrice",
        transaction.id
      );

      if (soldQuantity.greaterThan(quantity)) {
        throw new Error(
          `Cannot sell ${soldQuantity.toString()}; only ${quantity.toString()} is available`
        );
      }

      const averageNative = remainingCostNative.dividedBy(quantity);
      const averageReporting = remainingCostReporting.dividedBy(quantity);
      const allocatedNative = averageNative.times(soldQuantity);
      const allocatedReporting = averageReporting.times(soldQuantity);
      const netProceeds = soldQuantity.times(unitPrice).minus(fees);
      const reportingProceeds = netProceeds.times(fxRate);

      quantity = quantity.minus(soldQuantity);
      remainingCostNative = remainingCostNative.minus(allocatedNative);
      remainingCostReporting =
        remainingCostReporting.minus(allocatedReporting);
      realizedGainNative = realizedGainNative.plus(
        netProceeds.minus(allocatedNative)
      );
      realizedGainReporting = realizedGainReporting.plus(
        reportingProceeds.minus(allocatedReporting)
      );
      feesNative = feesNative.plus(fees);
      feesReporting = feesReporting.plus(fees.times(fxRate));
      cashEffect = cashEffect.plus(
        calculateTransactionCashEffect(transaction)
      );

      if (quantity.isZero()) {
        remainingCostNative = new PortfolioDecimal(0);
        remainingCostReporting = new PortfolioDecimal(0);
      }
      continue;
    }

    if (transaction.type === "DIVIDEND") {
      const grossDividend = requiredPositive(
        transaction.cashAmount,
        "cashAmount",
        transaction.id
      );
      const netDividend = grossDividend.minus(fees);
      dividendsNative = dividendsNative.plus(netDividend);
      dividendsReporting = dividendsReporting.plus(netDividend.times(fxRate));
      feesNative = feesNative.plus(fees);
      feesReporting = feesReporting.plus(fees.times(fxRate));
      cashEffect = cashEffect.plus(
        calculateTransactionCashEffect(transaction)
      );
      continue;
    }

    const accountFee = requiredPositive(
      transaction.cashAmount,
      "cashAmount",
      transaction.id
    );
    feesNative = feesNative.plus(accountFee);
    feesReporting = feesReporting.plus(accountFee.times(fxRate));
    cashEffect = cashEffect.plus(calculateTransactionCashEffect(transaction));
  }

  const averageCostNative = quantity.isZero()
    ? new PortfolioDecimal(0)
    : remainingCostNative.dividedBy(quantity);

  return {
    quantity: quantity.toString(),
    remainingCostNative: remainingCostNative.toString(),
    remainingCostReporting: remainingCostReporting.toString(),
    averageCostNative: averageCostNative.toString(),
    realizedGainNative: realizedGainNative.toString(),
    realizedGainReporting: realizedGainReporting.toString(),
    dividendsNative: dividendsNative.toString(),
    dividendsReporting: dividendsReporting.toString(),
    feesNative: feesNative.toString(),
    feesReporting: feesReporting.toString(),
    cashEffect: cashEffect.toString(),
  };
}

export function calculateMarketValue(
  quantity: Decimal.Value,
  price: Decimal.Value
) {
  return new PortfolioDecimal(quantity).times(price).toString();
}

export function addDecimalValues(values: Decimal.Value[]) {
  let total = new PortfolioDecimal(0);
  for (const value of values) {
    total = total.plus(value);
  }
  return total.toString();
}
