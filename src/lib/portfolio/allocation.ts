import Decimal from "decimal.js";
import type {
  PortfolioAllocationDto,
  PortfolioAssetDto,
} from "@/lib/portfolio/dtos";

const AllocationDecimal = Decimal.clone({
  precision: 34,
  rounding: Decimal.ROUND_HALF_UP,
});

/**
 * Share percentages are published with one decimal, so the largest-remainder
 * pass below distributes tenths of a percent.
 */
const SHARE_UNITS = 1000;

export type AllocationInput = {
  key: string;
  label: string;
  sublabel?: string;
  value: string;
};

export type AllocationSlice = {
  key: string;
  label: string;
  sublabel: string;
  value: string;
  share: number;
};

/**
 * Distributes display shares with the largest-remainder method so the rounded
 * percentages add up to exactly 100 instead of drifting to 99.9 or 100.1.
 */
export function calculateAllocation(
  inputs: AllocationInput[]
): AllocationSlice[] {
  const positive = inputs.filter((input) =>
    new AllocationDecimal(input.value).greaterThan(0)
  );
  if (positive.length === 0) return [];

  const total = positive.reduce(
    (sum, input) => sum.plus(input.value),
    new AllocationDecimal(0)
  );
  if (total.isZero()) return [];

  const exact = positive.map((input) => {
    const units = new AllocationDecimal(input.value)
      .dividedBy(total)
      .times(SHARE_UNITS);
    const floor = units.floor();
    return { input, floor, remainder: units.minus(floor) };
  });

  let assigned = exact.reduce(
    (sum, entry) => sum + entry.floor.toNumber(),
    0
  );
  const units = new Map(
    exact.map((entry) => [entry.input.key, entry.floor.toNumber()])
  );

  const byRemainder = [...exact].sort((left, right) => {
    const difference = right.remainder.comparedTo(left.remainder);
    if (difference !== 0) return difference;
    return left.input.key.localeCompare(right.input.key);
  });

  let cursor = 0;
  while (assigned < SHARE_UNITS && byRemainder.length > 0) {
    const entry = byRemainder[cursor % byRemainder.length];
    units.set(entry.input.key, (units.get(entry.input.key) ?? 0) + 1);
    assigned += 1;
    cursor += 1;
  }

  return positive
    .map((input) => ({
      key: input.key,
      label: input.label,
      sublabel: input.sublabel ?? "",
      value: new AllocationDecimal(input.value).toString(),
      share: (units.get(input.key) ?? 0) / 10,
    }))
    .sort((left, right) => {
      const difference = new AllocationDecimal(right.value).comparedTo(
        left.value
      );
      if (difference !== 0) return difference;
      return left.key.localeCompare(right.key);
    });
}

/**
 * Sums allocation inputs that share a grouping key, e.g. asset type.
 */
export function groupAllocation(
  inputs: Array<AllocationInput & { groupKey: string; groupLabel: string }>
): AllocationInput[] {
  const groups = new Map<string, { label: string; total: Decimal }>();

  for (const input of inputs) {
    const current = groups.get(input.groupKey);
    if (current) {
      current.total = current.total.plus(input.value);
      continue;
    }
    groups.set(input.groupKey, {
      label: input.groupLabel,
      total: new AllocationDecimal(input.value),
    });
  }

  return Array.from(groups.entries()).map(([key, group]) => ({
    key,
    label: group.label,
    value: group.total.toString(),
  }));
}

const ALLOCATION_PALETTE = [
  "#2563eb",
  "#16a34a",
  "#f59e0b",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#dc2626",
  "#65a30d",
];

export function allocationColor(index: number) {
  return ALLOCATION_PALETTE[index % ALLOCATION_PALETTE.length];
}

const ASSET_TYPE_LABELS: Record<PortfolioAssetDto["type"], string> = {
  STOCK: "Stocks",
  ETF: "ETFs",
  CRYPTO: "Crypto",
};

export type AllocatablePosition = {
  accountId: string;
  accountName: string;
  asset: PortfolioAssetDto;
  marketValueReporting: string | null;
};

function withColors(inputs: AllocationInput[], excludedSymbols: string[]) {
  return {
    slices: calculateAllocation(inputs).map((slice, index) => ({
      ...slice,
      color: allocationColor(index),
    })),
    excludedSymbols: Array.from(new Set(excludedSymbols)).sort(),
  };
}

/**
 * Builds the per-position and per-asset-type allocations from open positions.
 *
 * Allocation needs a single shared currency, so positions without a complete
 * reporting value are excluded from the slices and reported by symbol instead
 * of being silently treated as zero.
 */
export function buildPortfolioAllocation(positions: AllocatablePosition[]): {
  positionAllocation: PortfolioAllocationDto;
  assetTypeAllocation: PortfolioAllocationDto;
} {
  const excludedSymbols = positions
    .filter((position) => position.marketValueReporting === null)
    .map((position) => position.asset.symbol);

  const inputs = positions
    .filter((position) => position.marketValueReporting !== null)
    .map((position) => ({
      key: `${position.accountId}-${position.asset.id}`,
      label: position.asset.symbol,
      sublabel: position.accountName,
      value: position.marketValueReporting as string,
      groupKey: position.asset.type,
      groupLabel: ASSET_TYPE_LABELS[position.asset.type],
    }));

  return {
    positionAllocation: withColors(inputs, excludedSymbols),
    assetTypeAllocation: withColors(groupAllocation(inputs), excludedSymbols),
  };
}
