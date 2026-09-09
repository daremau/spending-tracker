import {
  endOfDay,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfYear,
  subMonths,
} from "date-fns";

export type AnalyticsPeriod =
  | "all"
  | "month"
  | "3m"
  | "6m"
  | "last12m"
  | "year"
  | "custom";

export const DEFAULT_PERIOD: AnalyticsPeriod = "all";

export const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "month", label: "This month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "last12m", label: "Last 12 months" },
  { value: "year", label: "Year" },
  { value: "custom", label: "Custom…" },
];

export interface AnalyticsFilter {
  period: AnalyticsPeriod;
  year?: number;
  from?: string;
  to?: string;
}

export function isAnalyticsPeriod(value: unknown): value is AnalyticsPeriod {
  return PERIOD_OPTIONS.some((option) => option.value === value);
}

export function parseYearParam(raw?: string | null): number | undefined {
  if (!raw || !/^\d{4}$/.test(raw.trim())) return undefined;
  const year = Number(raw.trim());
  if (year < 1970 || year > 2100) return undefined;
  return year;
}

export function parseDateParam(raw?: string | null): Date | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return undefined;
  const date = parseISO(trimmed);
  return isValid(date) ? date : undefined;
}

export function resolveDateRange(
  filter: AnalyticsFilter,
  now: Date
): { start: Date | undefined; end: Date } {
  switch (filter.period) {
    case "month":
      return { start: startOfMonth(now), end: now };
    case "3m":
      return { start: startOfMonth(subMonths(now, 2)), end: now };
    case "6m":
      return { start: startOfMonth(subMonths(now, 5)), end: now };
    case "last12m":
      return { start: startOfMonth(subMonths(now, 11)), end: now };
    case "year": {
      if (filter.year !== undefined) {
        const base = new Date(filter.year, 0, 1);
        return { start: startOfYear(base), end: endOfYear(base) };
      }
      return { start: startOfYear(now), end: now };
    }
    case "custom": {
      const from = parseDateParam(filter.from);
      const to = parseDateParam(filter.to);
      if (from && to) {
        const [startRaw, endRaw] = from <= to ? [from, to] : [to, from];
        return { start: startOfDay(startRaw), end: endOfDay(endRaw) };
      }
      if (from) {
        return {
          start: startOfDay(from),
          end: from > now ? endOfDay(from) : now,
        };
      }
      if (to) {
        return { start: undefined, end: endOfDay(to) };
      }
      return { start: undefined, end: now };
    }
    default:
      return { start: undefined, end: now };
  }
}

export const getPeriodLabel = (filter: AnalyticsFilter, now = new Date()) => {
  switch (filter.period) {
    case "month":
      return format(now, "MMMM yyyy");
    case "3m":
      return "Last 3 months";
    case "6m":
      return "Last 6 months";
    case "last12m":
      return "Last 12 months";
    case "year":
      return String(filter.year ?? now.getFullYear());
    case "custom": {
      const from = parseDateParam(filter.from);
      const to = parseDateParam(filter.to);
      if (from && to) {
        const [startRaw, endRaw] = from <= to ? [from, to] : [to, from];
        return `${format(startRaw, "MMM d, yyyy")} – ${format(endRaw, "MMM d, yyyy")}`;
      }
      if (from) return `From ${format(from, "MMM d, yyyy")}`;
      if (to) return `Until ${format(to, "MMM d, yyyy")}`;
      return "Custom range";
    }
    default:
      return "All time";
  }
};
