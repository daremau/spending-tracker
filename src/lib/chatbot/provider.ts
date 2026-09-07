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
  const userContent: unknown[] = [];
  if (text.trim()) userContent.push({ type: "text", text: text.slice(0, 6000) });
  for (const p of toImageParts(images)) userContent.push(p);
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
    throw new Error(`Proveedor ${res.status}: ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? '{"drafts":[]}';
  const parsed: unknown = JSON.parse(content);
  const validated = extractResponseSchema.safeParse(parsed);
  if (!validated.success) throw new Error("Respuesta del modelo inválida");
  return validated.data;
}

/** Llama al modelo principal y cae al fallback si falla. */
export async function extractWithFallback(
  creds: ProviderCredentials,
  system: string,
  text: string,
  images: ChatImage[]
): Promise<{ result: ExtractResponse; model: string }> {
  try {
    const result = await callOnce(creds, creds.model, system, text, images);
    return { result, model: creds.model };
  } catch (e) {
    if (!creds.fallbackModel || creds.fallbackModel === creds.model) throw e;
    const result = await callOnce(
      creds,
      creds.fallbackModel,
      system,
      text,
      images
    );
    return { result, model: creds.fallbackModel };
  }
}
