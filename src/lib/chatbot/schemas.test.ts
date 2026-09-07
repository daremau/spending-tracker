import { describe, expect, it } from "vitest";
import { confirmDraftSchema, extractResponseSchema } from "./schemas";

describe("extractResponseSchema", () => {
  it("acepta un draft mínimo válido", () => {
    const r = extractResponseSchema.safeParse({
      drafts: [{ merchant: "Biggie", amount: 45000, date: "2026-09-07" }],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza montos no positivos", () => {
    const r = extractResponseSchema.safeParse({
      drafts: [{ merchant: "X", amount: -5, date: "2026-09-07" }],
    });
    expect(r.success).toBe(false);
  });
});

describe("confirmDraftSchema", () => {
  it("exige type para confirmar", () => {
    const r = confirmDraftSchema.safeParse({
      merchant: "Biggie",
      amount: 45000,
      date: "2026-09-07",
      type: null,
    });
    expect(r.success).toBe(false);
  });
});
