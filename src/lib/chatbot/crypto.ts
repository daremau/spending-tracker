import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;

function getKey(): Buffer {
  const secret = process.env.CHATBOT_KEY_SECRET;
  if (!secret) {
    throw new Error(
      "CHATBOT_KEY_SECRET no está configurado. Genera uno con: openssl rand -base64 32"
    );
  }
  // Acepta base64 o raw; deriva a 32 bytes.
  let key: Buffer;
  try {
    key = Buffer.from(secret, "base64");
  } catch {
    key = Buffer.from(secret);
  }
  if (key.length < 32) {
    // Pad determinístico simple si el secreto es corto (solo dev).
    const padded = Buffer.alloc(32);
    key.copy(padded);
    return padded;
  }
  return key.subarray(0, 32);
}

/** Cifra la API key del usuario. Formato: iv:tag:payload (base64). */
export function encryptApiKey(plain: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString(
    "base64"
  )}`;
}

export function decryptApiKey(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Formato de key inválido");
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function keyLast4(key: string): string {
  const t = key.trim();
  return t.slice(-4);
}
