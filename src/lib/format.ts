/**
 * Strip thousands separators (commas / spaces / underscores) from a raw
 * amount string and validate that the result is a decimal with at most
 * two fractional digits. Returns the clean numeric string (e.g. "1000.50")
 * or "" when the input is empty/invalid.
 */
export function parseAmountInput(raw: string): string {
  if (!raw) return "";
  // Remove everything that is not a digit or a dot first.
  let cleaned = raw.replace(/[^\d.]/g, "");
  // Collapse multiple dots: keep only the first one.
  const firstDot = cleaned.indexOf(".");
  if (firstDot !== -1) {
    cleaned =
      cleaned.slice(0, firstDot + 1) +
      cleaned.slice(firstDot + 1).replace(/\./g, "");
  }
  // Limit to two decimal digits.
  const dotIdx = cleaned.indexOf(".");
  if (dotIdx !== -1 && cleaned.length - dotIdx - 1 > 2) {
    cleaned = cleaned.slice(0, dotIdx + 3);
  }
  return cleaned;
}

/**
 * Inverse of parseAmountInput: takes a clean numeric string ("1000.5")
 * and returns it with en-US thousands separators in the integer part
 * ("1,000.5"). A trailing "." is preserved so the user can keep typing
 * decimals. Empty input returns "".
 */
export function formatWithThousands(raw: string): string {
  if (!raw) return "";
  let integerPart = raw;
  let decimalPart = "";
  const dotIdx = raw.indexOf(".");
  if (dotIdx !== -1) {
    integerPart = raw.slice(0, dotIdx);
    decimalPart = raw.slice(dotIdx); // includes the leading "."
  }
  // Trim a leading "0" run except for a single "0" when there are decimals.
  if (integerPart.length > 1 && integerPart.startsWith("0")) {
    integerPart = integerPart.replace(/^0+/, "") || "0";
  }
  const withCommas = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return withCommas + decimalPart;
}

/**
 * Convert a possibly-formatted amount string into a number, tolerating
 * thousands separators. Returns NaN when the value cannot be parsed.
 */
export function amountToNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return NaN;
  if (typeof value === "number") return value;
  const cleaned = parseAmountInput(value);
  if (cleaned === "" || cleaned === ".") return NaN;
  return parseFloat(cleaned);
}
