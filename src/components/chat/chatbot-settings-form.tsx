"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  clearChatbotKey,
  resetChatbotDefaults,
  saveChatbotSettings,
  testChatbotConnection,
} from "@/actions/chatbot-settings";

export type ChatbotStatus = {
  providerBaseUrl: string;
  model: string;
  fallbackModel: string;
  configured: boolean;
  keyLast4?: string | null;
};

export function ChatbotSettingsForm({ status }: { status: ChatbotStatus }) {
  const [open, setOpen] = useState(!status.configured);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    setError(null);
    setMessage(null);
    const result = await saveChatbotSettings(formData);
    setLoading(false);
    if (result?.error) setError(result.error);
    else {
      setMessage("Configuración guardada");
      setOpen(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setError(null);
    setMessage(null);
    const result = await testChatbotConnection();
    setTesting(false);
    if (result?.error) setError(result.error);
    else
      setMessage(
        `Conexión OK (${result.models ?? "?"} modelos${result.modelFound ? ", modelo encontrado" : ""})`
      );
  }

  async function handleClear() {
    if (!confirm("¿Borrar la API key guardada?")) return;
    await clearChatbotKey();
  }

  async function handleReset() {
    if (!confirm("¿Volver a los defaults de Ollama Cloud? (conserva tu key)"))
      return;
    setLoading(true);
    await resetChatbotDefaults();
    setLoading(false);
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-3 text-sm">
        <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
        <span className="flex-1">
          Bot listo · {status.model}
          {status.keyLast4 ? ` · ••••${status.keyLast4}` : ""}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Configurar
        </Button>
      </div>
    );
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-3 rounded-lg border p-3 text-sm"
    >
      <div className="font-medium">Configurar chatbot IA</div>
      <p className="text-xs text-muted-foreground">
        Usa tu API key de Ollama Cloud (creala en ollama.com/settings/keys).
        Se guarda cifrada en el servidor, nunca en el navegador.
      </p>
      {error && (
        <div className="rounded-md bg-red-50 p-2 text-xs text-red-600 dark:bg-red-950">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md bg-green-50 p-2 text-xs text-green-700 dark:bg-green-950">
          {message}
        </div>
      )}
      <div className="space-y-1">
        <Label htmlFor="providerBaseUrl">Base URL</Label>
        <Input
          id="providerBaseUrl"
          name="providerBaseUrl"
          defaultValue={status.providerBaseUrl}
          placeholder="https://ollama.com/v1"
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label htmlFor="model">Modelo (visión)</Label>
          <Input id="model" name="model" defaultValue={status.model} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="fallbackModel">Fallback</Label>
          <Input
            id="fallbackModel"
            name="fallbackModel"
            defaultValue={status.fallbackModel}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="apiKey">
          API key {status.configured ? "(dejar vacío para no cambiar)" : ""}
        </Label>
        <Input
          id="apiKey"
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder={status.configured ? "••••" : "sk-..."}
        />
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={loading}>
          {loading ? "Guardando..." : "Guardar"}
        </Button>
        {status.configured && (
          <>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleTest}
              disabled={testing}
            >
              {testing ? "Probando..." : "Probar conexión"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={handleReset}
            >
              Defaults
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-red-600"
              onClick={handleClear}
            >
              Borrar key
            </Button>
          </>
        )}
      </div>
    </form>
  );
}
