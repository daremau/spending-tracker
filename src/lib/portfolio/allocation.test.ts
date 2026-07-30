import { describe, expect, it } from "vitest";
import {
  allocationColor,
  calculateAllocation,
  groupAllocation,
} from "./allocation";

function sumShares(slices: Array<{ share: number }>) {
  return Number(
    slices.reduce((sum, slice) => sum + slice.share, 0).toFixed(1)
  );
}

describe("calculateAllocation", () => {
  it("returns no slices when there is nothing to allocate", () => {
    expect(calculateAllocation([])).toEqual([]);
    expect(
      calculateAllocation([{ key: "a", label: "A", value: "0" }])
    ).toEqual([]);
  });

  it("ignores non-positive values", () => {
    const slices = calculateAllocation([
      { key: "a", label: "A", value: "100" },
      { key: "b", label: "B", value: "0" },
      { key: "c", label: "C", value: "-50" },
    ]);

    expect(slices.map((slice) => slice.key)).toEqual(["a"]);
    expect(slices[0].share).toBe(100);
  });

  it("sums to exactly 100 for three equal thirds", () => {
    const slices = calculateAllocation([
      { key: "a", label: "A", value: "1000" },
      { key: "b", label: "B", value: "1000" },
      { key: "c", label: "C", value: "1000" },
    ]);

    expect(sumShares(slices)).toBe(100);
    expect(slices.map((slice) => slice.share).sort()).toEqual([
      33.3, 33.3, 33.4,
    ]);
  });

  it("sums to exactly 100 for seven repeating shares", () => {
    const slices = calculateAllocation(
      Array.from({ length: 7 }, (_, index) => ({
        key: `k${index}`,
        label: `K${index}`,
        value: "1",
      }))
    );

    expect(slices).toHaveLength(7);
    expect(sumShares(slices)).toBe(100);
  });

  it("sums to exactly 100 for high-precision crypto quantities", () => {
    const slices = calculateAllocation([
      { key: "btc", label: "BTC", value: "0.000000012345" },
      { key: "eth", label: "ETH", value: "0.000000098765" },
      { key: "sol", label: "SOL", value: "0.000000000001" },
    ]);

    expect(sumShares(slices)).toBe(100);
  });

  it("orders slices from largest to smallest value", () => {
    const slices = calculateAllocation([
      { key: "small", label: "Small", value: "10" },
      { key: "big", label: "Big", value: "90" },
      { key: "mid", label: "Mid", value: "50" },
    ]);

    expect(slices.map((slice) => slice.key)).toEqual(["big", "mid", "small"]);
    expect(slices[0].share).toBe(60);
    expect(sumShares(slices)).toBe(100);
  });

  it("rounds a negligible holding to zero without breaking the total", () => {
    const slices = calculateAllocation([
      { key: "a", label: "A", value: "999999" },
      { key: "b", label: "B", value: "1" },
    ]);

    expect(sumShares(slices)).toBe(100);
    expect(slices.find((slice) => slice.key === "b")?.share).toBe(0);
  });

  it("carries the sublabel through", () => {
    const slices = calculateAllocation([
      { key: "a", label: "AAPL", sublabel: "Brokerage", value: "10" },
    ]);

    expect(slices[0].sublabel).toBe("Brokerage");
  });
});

describe("groupAllocation", () => {
  it("sums inputs sharing a group key", () => {
    const grouped = groupAllocation([
      {
        key: "p1",
        label: "AAPL",
        value: "100",
        groupKey: "STOCK",
        groupLabel: "Stocks",
      },
      {
        key: "p2",
        label: "MSFT",
        value: "50.5",
        groupKey: "STOCK",
        groupLabel: "Stocks",
      },
      {
        key: "p3",
        label: "BTC",
        value: "25",
        groupKey: "CRYPTO",
        groupLabel: "Crypto",
      },
    ]);

    expect(grouped).toEqual([
      { key: "STOCK", label: "Stocks", value: "150.5" },
      { key: "CRYPTO", label: "Crypto", value: "25" },
    ]);
  });

  it("produces group shares that still sum to 100", () => {
    const slices = calculateAllocation(
      groupAllocation([
        {
          key: "p1",
          label: "AAPL",
          value: "1",
          groupKey: "STOCK",
          groupLabel: "Stocks",
        },
        {
          key: "p2",
          label: "BTC",
          value: "1",
          groupKey: "CRYPTO",
          groupLabel: "Crypto",
        },
        {
          key: "p3",
          label: "VOO",
          value: "1",
          groupKey: "ETF",
          groupLabel: "ETFs",
        },
      ])
    );

    expect(sumShares(slices)).toBe(100);
  });
});

describe("allocationColor", () => {
  it("cycles deterministically", () => {
    expect(allocationColor(0)).toBe(allocationColor(8));
    expect(allocationColor(0)).not.toBe(allocationColor(1));
  });
});
