export type AnalyticsPeriod = "all" | "month" | "3m" | "6m" | "year";

export const DEFAULT_PERIOD: AnalyticsPeriod = "all";

export const PERIOD_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "month", label: "This month" },
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "year", label: "This year" },
];

export const getPeriodLabel = (period: AnalyticsPeriod) =>
  PERIOD_OPTIONS.find((option) => option.value === period)?.label || "All time";
