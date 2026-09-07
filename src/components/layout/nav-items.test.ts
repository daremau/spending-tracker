import { describe, expect, it } from "vitest";
import {
  getDesktopNavItems,
  getMobileNavItems,
  isNavActive,
} from "./nav-items";

describe("getMobileNavItems", () => {
  it("keeps five destinations when the portfolio is enabled", () => {
    const items = getMobileNavItems(true);

    expect(items).toHaveLength(5);
    expect(items.map((item) => item.href)).toEqual([
      "/",
      "/accounts",
      "/transactions",
      "/portfolio",
      "/more",
    ]);
  });

  it("keeps the previous destinations when the portfolio is disabled", () => {
    const items = getMobileNavItems(false);

    expect(items.map((item) => item.href)).toEqual([
      "/",
      "/accounts",
      "/transactions",
      "/categories",
      "/analytics",
    ]);
    expect(items.some((item) => item.href === "/portfolio")).toBe(false);
  });
});

describe("getDesktopNavItems", () => {
  it("puts Portfolio between transactions and the secondary items", () => {
    expect(getDesktopNavItems(true).map((item) => item.href)).toEqual([
      "/",
      "/accounts",
      "/transactions",
      "/portfolio",
      "/categories",
      "/analytics",
    ]);
  });

  it("omits Portfolio when the feature is disabled", () => {
    expect(getDesktopNavItems(false).map((item) => item.href)).toEqual([
      "/",
      "/accounts",
      "/transactions",
      "/categories",
      "/analytics",
    ]);
  });
});

describe("isNavActive", () => {
  it("keeps Portfolio highlighted on an account detail route", () => {
    expect(isNavActive("/portfolio", "/portfolio/accounts/abc123")).toBe(true);
  });

  it("does not highlight Accounts for a portfolio account route", () => {
    expect(isNavActive("/accounts", "/portfolio/accounts/abc123")).toBe(false);
  });

  it("matches Home only on the exact root path", () => {
    expect(isNavActive("/", "/")).toBe(true);
    expect(isNavActive("/", "/portfolio")).toBe(false);
  });

  it("highlights Accounts on a bank account detail route", () => {
    expect(isNavActive("/accounts", "/accounts/abc123")).toBe(true);
  });
});
