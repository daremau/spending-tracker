import { describe, expect, it } from "vitest";
import { normalizeMerchant } from "./normalize";

describe("normalizeMerchant", () => {
  it("lowercases and strips accents", () => {
    expect(normalizeMerchant("Biggie  Express")).toBe("biggie express");
    expect(normalizeMerchant("Ñandutí Café")).toBe("nanduti cafe");
  });

  it("removes punctuation and collapses spaces", () => {
    expect(normalizeMerchant("  SUPER-6  (Suc. España) ")).toBe(
      "super 6 suc espana"
    );
  });

  it("returns empty for empty input", () => {
    expect(normalizeMerchant("")).toBe("");
  });
});
