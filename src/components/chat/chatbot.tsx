"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bot, ImagePlus, Loader2, Send, X } from "lucide-react";
import { createChatbotTransactions } from "@/actions/chatbot";
import {
  DraftReviewTable,
  type UIAccount,
  type UICategory,
  type UIDraft,
} from "./draft-review-table";

type Msg = { role: "user" | "bot"; text: string };

async function fileToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) {
    // Fallback sin compresión (ej. formato raro).
    return await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }
  const maxSide = 1568;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas no disponible");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85);
}

export function Chatbot({
  accounts,
  incomeCategories,
  expenseCategories,
  defaultAccountId,
  memoryCount,
}: {
  accounts: UIAccount[];
  incomeCategories: UICategory[];
  expenseCategories: UICategory[];
  defaultAccountId: string | null;
  memoryCount: number;
}) {
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "bot",
      text: "Hola 👋 Mándame un screenshot o escribí ej. “Biggie 45.000 ayer”. Te muestro la lista para revisar antes de cargar.",
    },
  ]);
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [drafts, setDrafts] = useState<UIDraft[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function patchDraft(key: string, patch: Partial<UIDraft>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 3 - images.length);
    if (files.length === 0) return;
    try {
      const urls = await Promise.all(files.map(fileToDataUrl));
      setImages((prev) => [...prev, ...urls].slice(0, 3));
    } catch {
      setError("No se pudo leer la imagen");
    } finally {
      e.target.value = "";
    }
  }

  async function handleSend() {
    if (extracting || (!text.trim() && images.length === 0)) return;
    setError(null);
    setLastCount(null);
    const userText = text.trim();
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        text:
          userText || (images.length > 0 ? "📷 Screenshot" : ""),
      },
    ]);
    setText("");
    setExtracting(true);
    try {
      const res = await fetch("/api/chat/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: userText,
          images: images.map((dataUrl) => ({ dataUrl })),
          defaultAccountId,
        }),
      });
      const json = (await res.json()) as {
        drafts?: UIDraft[];
        error?: string;
        model?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Falló la extracción");
      const incoming: UIDraft[] = (json.drafts ?? []).map((d) => ({
        ...d,
        key: crypto.randomUUID(),
        description: d.description ?? d.merchant,
        applyDigitalTax: false,
      }));
      setImages([]);
      if (incoming.length === 0) {
        setMessages((prev) => [
          ...prev,
          { role: "bot", text: "No detecté transacciones. Probá con otra foto o más detalle." },
        ]);
      } else {
        setDrafts((prev) => [...prev, ...incoming]);
        const pending = incoming.filter((d) => d.needsClarification).length;
        setMessages((prev) => [
          ...prev,
          {
            role: "bot",
            text:
              pending > 0
                ? `Detecté ${incoming.length}. ${pending} necesitan que confirmes tipo/categoría 👇`
                : `Detecté ${incoming.length}. Revisá y confirmá 👇`,
          },
        ]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error inesperado");
    } finally {
      setExtracting(false);
    }
  }

  async function handleConfirm() {
    if (confirming || drafts.length === 0) return;
    setError(null);
    const invalid = drafts.findIndex((d) => !d.type || !d.amount || !d.accountId);
    if (invalid !== -1) {
      setError(`La fila ${invalid + 1} necesita tipo, monto y cuenta`);
      return;
    }
    setConfirming(true);
    try {
      const result = await createChatbotTransactions(
        drafts.map((d) => ({
          merchant: d.merchant,
          amount: d.amount,
          date: d.date,
          type: d.type,
          categoryId: d.categoryId,
          accountId: d.accountId,
          toAccountId: d.toAccountId,
          description: d.description,
          applyDigitalTax: d.applyDigitalTax,
        }))
      );
      if (result?.error) throw new Error(result.error);
      setLastCount(result.count ?? drafts.length);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `✅ Cargué ${result.count ?? drafts.length} transacción(es) con etiqueta Bot. Ya aprendí estos comercios para la próxima (${memoryCount + drafts.length} en memoria).`,
        },
      ]);
      setDrafts([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {m.role === "bot" && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <p
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {extracting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Leyendo...
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-2 text-sm text-red-600 dark:bg-red-950">
          {error}
        </div>
      )}
      {lastCount !== null && (
        <div className="rounded-md bg-green-50 p-2 text-sm text-green-700 dark:bg-green-950">
          Listo ✅{" "}
          <Link href="/transactions?source=CHATBOT" className="underline">
            Ver cargadas por el Bot
          </Link>
        </div>
      )}

      <DraftReviewTable
        drafts={drafts}
        accounts={accounts}
        incomeCategories={incomeCategories}
        expenseCategories={expenseCategories}
        onChange={patchDraft}
        onRemove={removeDraft}
      />

      {drafts.length > 0 && (
        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? "Cargando..." : `Confirmar y cargar ${drafts.length}`}
          </Button>
          <Button variant="outline" onClick={() => setDrafts([])}>
            Limpiar
          </Button>
        </div>
      )}

      {images.length > 0 && (
        <div className="flex gap-2">
          {images.map((src, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`adjunto ${i + 1}`}
                className="h-16 w-16 rounded-md border object-cover"
              />
              <button
                className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 shadow"
                onClick={() => setImages((prev) => prev.filter((_, j) => j !== i))}
                aria-label="Quitar imagen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="sticky bottom-16 flex gap-2 md:bottom-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => fileRef.current?.click()}
          disabled={images.length >= 3 || extracting}
          aria-label="Adjuntar screenshot"
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
          onChange={handlePick}
        />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ej. Biggie 45.000, farmacia 120.000..."
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
        />
        <Button onClick={handleSend} disabled={extracting} aria-label="Enviar">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
