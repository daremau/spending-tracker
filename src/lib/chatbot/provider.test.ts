import { afterEach, describe, expect, it, vi } from "vitest";
import { extractWithFallback, safeJsonParse } from "./provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

function okDrafts() {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: '{"drafts":[]}' } }],
    }),
    text: async () => "",
  };
}

function fail(status: number, msg: string) {
  return {
    ok: false,
    status,
    json: async () => ({}),
    text: async () => msg,
  };
}

const creds = {
  apiKey: "k",
  baseUrl: "https://opencode.ai/inference/go/openai/v1",
  model: "deepseek-v4.1-flash",
  fallbackModel: "glm-5.3-flash",
};

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

describe("extractWithFallback", () => {
  it("usa el primario sin degraded cuando funciona", async () => {
    const fetch = vi.fn(async () => okDrafts());
    vi.stubGlobal("fetch", fetch);
    const r = await extractWithFallback(creds, "sys", "Biggie 45000", []);
    expect(r.model).toBe("deepseek-v4.1-flash");
    expect(r.degraded).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("manda sesión de OpenCode Go y User-Agent propio", async () => {
    const fetch = vi.fn(async () => okDrafts());
    vi.stubGlobal("fetch", fetch);
    await extractWithFallback(creds, "sys", "Biggie 45000", [], "ses-123");
    const call = fetch.mock.calls[0] as unknown as [
      string,
      { headers: Record<string, string> },
    ];
    expect(call[1].headers["x-opencode-session"]).toBe("ses-123");
    expect(call[1].headers["User-Agent"]).toBe("spending-tracker/1.0");
  });

  it("cae al fallback en texto plano sin degraded", async () => {
    const fetch = vi.fn(async () => okDrafts());
    fetch.mockRejectedValueOnce(new Error("caído"));
    vi.stubGlobal("fetch", fetch);
    const r = await extractWithFallback(creds, "sys", "Biggie 45000", []);
    expect(r.model).toBe("glm-5.3-flash");
    expect(r.degraded).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("con imágenes cae al fallback SIN imágenes y marca degraded", async () => {
    const fetch = vi.fn(async () => okDrafts());
    fetch.mockRejectedValueOnce(new Error("402 no entitled"));
    vi.stubGlobal("fetch", fetch);
    const r = await extractWithFallback(creds, "sys", "Biggie 45000", [
      { dataUrl: "data:image/jpeg;base64,xxx" },
    ]);
    expect(r.model).toBe("glm-5.3-flash");
    expect(r.degraded).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(2);
    const secondCall = fetch.mock.calls[1] as unknown as [
      string,
      { body: string },
    ];
    const secondBody = JSON.parse(secondCall[1].body) as {
      messages: { content: unknown[] }[];
    };
    const parts = secondBody.messages[1]?.content as unknown[];
    expect(parts.some((p) => (p as { type: string }).type === "image_url")).toBe(
      false
    );
  });

  it("con solo imágenes pide reintentar en texto sin llamar al fallback", async () => {
    const fetch = vi.fn(async () => okDrafts());
    fetch.mockRejectedValueOnce(new Error("402 no entitled"));
    vi.stubGlobal("fetch", fetch);
    await expect(
      extractWithFallback(creds, "sys", "", [
        { dataUrl: "data:image/jpeg;base64,xxx" },
      ])
    ).rejects.toThrow(/en texto/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("encadena ambos errores si todo falla", async () => {
    const fetch = vi
      .fn(async () => fail(500, "boom"))
      .mockResolvedValueOnce(fail(500, "boom"));
    vi.stubGlobal("fetch", fetch);
    await expect(
      extractWithFallback(creds, "sys", "texto", [])
    ).rejects.toThrow(/Primario.*Fallback/);
  });
});
