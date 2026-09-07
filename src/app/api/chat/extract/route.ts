import { NextResponse } from "next/server";
import { z } from "zod";
import { getChatbotCredentials } from "@/actions/chatbot-settings";
import { findMemoryMatches } from "@/actions/chatbot-memory";
import { getAccounts } from "@/actions/accounts";
import { getCategories } from "@/actions/categories";
import { buildExtractionSystemPrompt } from "@/lib/chatbot/prompt";
import { extractWithFallback } from "@/lib/chatbot/provider";
import { normalizeMerchant } from "@/lib/chatbot/normalize";

const bodySchema = z.object({
  text: z.string().max(6000).default(""),
  images: z
    .array(
      z.object({
        dataUrl: z
          .string()
          .regex(/^data:image\/(png|jpe?g|webp);base64,/, "imagen inválida")
          .max(3_000_000),
      })
    )
    .max(3)
    .default([]),
  defaultAccountId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Input inválido" },
      { status: 400 }
    );
  }
  const { text, images, defaultAccountId } = parsed.data;
  if (!text.trim() && images.length === 0) {
    return NextResponse.json({ error: "Envía texto o una imagen" }, { status: 400 });
  }

  const creds = await getChatbotCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: "Configura tu API key del chatbot primero (pestaña Bot → Configurar)" },
      { status: 400 }
    );
  }

  const [accounts, incomeCategories, expenseCategories] = await Promise.all([
    getAccounts(),
    getCategories("INCOME"),
    getCategories("EXPENSE"),
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const system = buildExtractionSystemPrompt({
    today,
    accounts: accounts.map((a) => ({
      id: a.id,
      name: a.name,
      currency: a.currency,
    })),
    incomeCategories: incomeCategories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    })),
    expenseCategories: expenseCategories.map((c) => ({
      id: c.id,
      name: c.name,
      type: c.type,
    })),
  });

  try {
    const { result, model } = await extractWithFallback(
      creds,
      system,
      text,
      images
    );

    // Merge con memoria: si el LLM duda y hay regla, autocompleta.
    const matches = await findMemoryMatches(
      result.drafts.map((d) => d.merchant)
    );
    const validCategoryIds = new Set([
      ...incomeCategories.map((c) => c.id),
      ...expenseCategories.map((c) => c.id),
    ]);
    const validAccountIds = new Set(accounts.map((a) => a.id));

    const drafts = result.drafts.slice(0, 20).map((d) => {
      const mem = matches[normalizeMerchant(d.merchant)];
      const memApplies =
        mem && (!d.type || d.needsClarification || (d.confidence ?? 0) < 0.85);
      const categoryId =
        d.categoryId && validCategoryIds.has(d.categoryId)
          ? d.categoryId
          : memApplies && mem.categoryId && validCategoryIds.has(mem.categoryId)
            ? mem.categoryId
            : null;
      const accountId =
        d.accountId && validAccountIds.has(d.accountId)
          ? d.accountId
          : memApplies && mem.accountId && validAccountIds.has(mem.accountId)
            ? mem.accountId
            : defaultAccountId && validAccountIds.has(defaultAccountId)
              ? defaultAccountId
              : null;
      const type = d.type ?? (memApplies ? mem.type : null);
      const resolved = Boolean(type && (categoryId || type === "TRANSFER") && accountId);
      return {
        ...d,
        type,
        categoryId,
        accountId,
        toAccountId:
          d.toAccountId && validAccountIds.has(d.toAccountId)
            ? d.toAccountId
            : null,
        date: /^\d{4}-\d{2}-\d{2}$/.test(d.date) ? d.date : today,
        needsClarification: resolved ? false : true,
        clarificationQuestion: resolved
          ? null
          : (d.clarificationQuestion ??
            (!type
              ? `¿"${d.merchant}" es gasto, ingreso o transferencia?`
              : !categoryId && type !== "TRANSFER"
                ? `¿Qué categoría le pongo a "${d.merchant}"?`
                : `¿En qué cuenta cargo "${d.merchant}"?`)),
        memoryApplied: Boolean(memApplies && mem),
      };
    });

    return NextResponse.json({ drafts, model });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Falló la extracción";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
