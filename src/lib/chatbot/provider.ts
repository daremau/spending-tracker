import { extractResponseSchema, type ExtractResponse } from "./schemas";

type ChatImage = { dataUrl: string };

export type ProviderCredentials = {
  apiKey: string;
  baseUrl: string;
  model: string;
  fallbackModel: string;
};

function toImageParts(images: ChatImage[]) {
  return images.slice(0, 3).map((img) => ({
    type: "image_url" as const,
    image_url: { url: img.dataUrl },
  }));
}

async function callOnce(
  creds: Pick<ProviderCredentials, "apiKey" | "baseUrl">,
  model: string,
  system: string,
  text: string,
  images: ChatImage[]
): Promise<ExtractResponse> {
  // Imágenes antes que el texto (best practice multimodal: ej. Gemma).
  const userContent: unknown[] = [...toImageParts(images)];
  if (text.trim()) userContent.push({ type: "text", text: text.slice(0, 6000) });
  if (userContent.length === 0) throw new Error("Mensaje vacío");

  const res = await fetch(`${creds.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${creds.apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: userContent },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `${model} → proveedor ${res.status}: ${body.slice(0, 300)}`
    );
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? '{"drafts":[]}';
  const parsed: unknown = safeJsonParse(content);
  const validated = extractResponseSchema.safeParse(parsed);
  if (!validated.success)
    throw new Error(`${model} → respuesta del modelo inválida`);
  return validated.data;
}

/**
 * Parsea JSON tolerando fences markdown y preámbulos de thinking-models
 * (ej. tags <|channel|>thought de Gemma). Extrae del primer `{` al último `}`.
 */
export function safeJsonParse(raw: string): unknown {
  const direct = tryParse(raw);
  if (direct !== undefined) return direct;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const sliced = tryParse(raw.slice(start, end + 1));
    if (sliced !== undefined) return sliced;
  }
  throw new SyntaxError("No se encontró JSON válido en la respuesta");
}

function tryParse(s: string): unknown | undefined {
  try {
    return JSON.parse(s) as unknown;
  } catch {
    // También intenta sin fences ```json ... ```
    const fenced = s
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    if (fenced !== s) {
      try {
        return JSON.parse(fenced) as unknown;
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

/** Llama al modelo principal y cae al fallback si falla. */
export async function extractWithFallback(
  creds: ProviderCredentials,
  system: string,
  text: string,
  images: ChatImage[]
): Promise<{ result: ExtractResponse; model: string }> {
  let primaryError: unknown = null;
  try {
    const result = await callOnce(creds, creds.model, system, text, images);
    return { result, model: creds.model };
  } catch (e) {
    primaryError = e;
  }
  if (!creds.fallbackModel || creds.fallbackModel === creds.model) {
    throw primaryError;
  }
  try {
    const result = await callOnce(
      creds,
      creds.fallbackModel,
      system,
      text,
      images
    );
    return { result, model: creds.fallbackModel };
  } catch (fallbackError) {
    // Encadena ambos errores para no tapar la causa real del primario.
    throw new Error(
      `Primario (${creds.model}): ${messageOf(primaryError)} | Fallback (${creds.fallbackModel}): ${messageOf(fallbackError)}`
    );
  }
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
