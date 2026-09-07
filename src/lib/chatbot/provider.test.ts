import { describe, expect, it } from "vitest";
import { safeJsonParse } from "./provider";

describe("safeJsonParse", () => {
  it("parsea JSON limpio", () => {
    expect(safeJsonParse('{"drafts":[]}')).toEqual({ drafts: [] });
  });

  it("tolera fences markdown", () => {
    expect(
      safeJsonParse('```json\n{"drafts":[]}\n```')
    ).toEqual({ drafts: [] });
  });

  it("tolera preámbulo thinking antes del JSON", () => {
    expect(
      safeJsonParse(
        '<|channel|>thought\nmirando la imagen<|channel|>{"drafts":[]}'
      )
    ).toEqual({ drafts: [] });
  });

  it("lanza si no hay JSON", () => {
    expect(() => safeJsonParse("sin json acá")).toThrow();
  });
});
