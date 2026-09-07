"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  decryptApiKey,
  encryptApiKey,
  keyLast4,
} from "@/lib/chatbot/crypto";

const SETTINGS_ID = "singleton";

const DEFAULT_BASE_URL =
  process.env.CHATBOT_BASE_URL ?? "https://ollama.com/v1";
const DEFAULT_MODEL = process.env.CHATBOT_MODEL ?? "gemma4:31b-cloud";
const DEFAULT_FALLBACK = process.env.CHATBOT_FALLBACK_MODEL ?? "gemma4:cloud";

async function ensureChatbotSettings() {
  return prisma.chatbotSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {},
    create: {
      id: SETTINGS_ID,
      providerBaseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
      fallbackModel: DEFAULT_FALLBACK,
    },
  });
}

export async function getChatbotStatus() {
  const s = await ensureChatbotSettings();
  return {
    providerBaseUrl: s.providerBaseUrl,
    model: s.model,
    fallbackModel: s.fallbackModel,
    configured: Boolean(s.encryptedKey),
    keyLast4: s.keyLast4,
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Guarda baseUrl/modelo y opcionalmente rota la API key (BYOK). */
export async function saveChatbotSettings(formData: FormData) {
  const providerBaseUrl =
    ((formData.get("providerBaseUrl") as string) || "").trim() ||
    DEFAULT_BASE_URL;
  const model = ((formData.get("model") as string) || "").trim() || DEFAULT_MODEL;
  const fallbackModel =
    ((formData.get("fallbackModel") as string) || "").trim() || DEFAULT_FALLBACK;
  const apiKey = ((formData.get("apiKey") as string) || "").trim();

  try {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const _ = new URL(`${providerBaseUrl.replace(/\/$/, "")}/models`);
  } catch {
    return { error: "Base URL inválida" };
  }

  const data: {
    providerBaseUrl: string;
    model: string;
    fallbackModel: string;
    encryptedKey?: string;
    keyLast4?: string;
  } = { providerBaseUrl, model, fallbackModel };

  if (apiKey) {
    try {
      data.encryptedKey = encryptApiKey(apiKey);
      data.keyLast4 = keyLast4(apiKey);
    } catch (e) {
      return {
        error:
          e instanceof Error ? e.message : "No se pudo cifrar la API key",
      };
    }
  }

  await prisma.chatbotSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });

  revalidatePath("/chat");
  revalidatePath("/more");
  return { success: true };
}

/** Restaura baseUrl/modelo/fallback a los defaults del código (conserva la key). */
export async function resetChatbotDefaults() {
  await prisma.chatbotSettings.upsert({
    where: { id: SETTINGS_ID },
    update: {
      providerBaseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
      fallbackModel: DEFAULT_FALLBACK,
    },
    create: {
      id: SETTINGS_ID,
      providerBaseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
      fallbackModel: DEFAULT_FALLBACK,
    },
  });
  revalidatePath("/chat");
  return { success: true };
}

export async function clearChatbotKey() {
  await prisma.chatbotSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { encryptedKey: null, keyLast4: null },
    create: {
      id: SETTINGS_ID,
      providerBaseUrl: DEFAULT_BASE_URL,
      model: DEFAULT_MODEL,
      fallbackModel: DEFAULT_FALLBACK,
    },
  });
  revalidatePath("/chat");
  return { success: true };
}

/** Solo server: devuelve key + endpoint para la route de extracción. */
export async function getChatbotCredentials() {
  const s = await ensureChatbotSettings();
  if (!s.encryptedKey) return null;
  try {
    return {
      apiKey: decryptApiKey(s.encryptedKey),
      baseUrl: s.providerBaseUrl.replace(/\/$/, ""),
      model: s.model,
      fallbackModel: s.fallbackModel,
    };
  } catch {
    return null;
  }
}

export async function testChatbotConnection() {
  const creds = await getChatbotCredentials();
  if (!creds) return { error: "Configura tu API key primero" };
  try {
    const res = await fetch(`${creds.baseUrl}/models`, {
      headers: { Authorization: `Bearer ${creds.apiKey}` },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      return { error: `Proveedor respondió ${res.status}. Revisa key/baseUrl.` };
    }
    const json = (await res.json()) as { data?: { id: string }[] };
    const ids = (json.data ?? []).map((m) => m.id);
    const hasModel =
      ids.length === 0 ||
      ids.includes(creds.model) ||
      ids.includes(creds.fallbackModel);
    return {
      success: true,
      models: ids.length,
      modelFound: hasModel,
    };
  } catch {
    return { error: "No se pudo conectar al proveedor (timeout/red)" };
  }
}
