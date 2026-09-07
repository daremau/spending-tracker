import { addDecimalValues } from "@/lib/portfolio/calculations";
import type { NetWorthSummaryDto } from "@/lib/portfolio/dtos";

export type NetWorthPart = {
  /** Value already converted to the reporting currency, or null when it could not be. */
  value: string | null;
  missingRates: string[];
};

export type NetWorthInput = {
  reportingCurrency: string;
  bankCash: NetWorthPart;
  investmentCash: NetWorthPart;
  holdings: NetWorthPart;
  missingQuotes: string[];
  hasInvestments: boolean;
};

/**
 * Net worth is standard bank cash plus investment cash plus holdings.
 *
 * Each part is counted exactly once: investment cash lives in `INVESTMENT_CASH`
 * bank accounts, which the bank-cash part deliberately excludes. The total is
 * only published when every part converted cleanly, so a missing rate or quote
 * surfaces as an explicit gap instead of a silently understated number.
 */
export function composeNetWorth(input: NetWorthInput): NetWorthSummaryDto {
  const parts = [input.bankCash, input.investmentCash, input.holdings];
  const complete =
    parts.every((part) => part.value !== null) && input.missingQuotes.length === 0;

  const investmentValueReporting =
    input.investmentCash.value !== null && input.holdings.value !== null
      ? addDecimalValues([input.investmentCash.value, input.holdings.value])
      : null;

  return {
    reportingCurrency: input.reportingCurrency,
    bankCashReporting: input.bankCash.value,
    investmentCashReporting: input.investmentCash.value,
    holdingsValueReporting: input.holdings.value,
    investmentValueReporting,
    netWorthReporting: complete
      ? addDecimalValues(parts.map((part) => part.value as string))
      : null,
    complete,
    missingRates: Array.from(
      new Set(parts.flatMap((part) => part.missingRates))
    ).sort(),
    missingQuotes: Array.from(new Set(input.missingQuotes)).sort(),
    hasInvestments: input.hasInvestments,
  };
}
