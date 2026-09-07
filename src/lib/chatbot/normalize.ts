/**
 * Normaliza un merchant/descripción para usarlo como clave de memoria.
 * - minúsculas, sin acentos, colapsa espacios y signos.
 * - recorta a 80 chars.
 */
export function normalizeMerchant(raw: string): string {
  if (!raw) return "";
  const withoutAccents = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const cleaned = withoutAccents
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.slice(0, 80);
}
