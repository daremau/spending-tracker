"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";

export function ExportPanel({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState<"csv" | "excel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: "csv" | "excel") {
    setLoading(format);
    setError(null);

    try {
      const response = await fetch(`/api/backup?format=${format}`, {
        method: "GET",
      });

      if (!response.ok) {
        let message = "Failed to export backup";
        try {
          const data = await response.json();
          message =
            data.error || data.errors?.join("\n") || message;
        } catch {
          // Non-JSON error body: keep the generic message.
        }
        setError(message);
        return;
      }

      const blob = await response.blob();
      const disposition =
        response.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="?([^";]+)"?/);
      const filename =
        match?.[1] ?? (format === "csv" ? "backup.csv" : "backup.xlsx");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      onClose();
    } catch {
      setError("Failed to export backup");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Download a backup of all your accounts, categories, and transactions.
      </p>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => handleExport("csv")}
          disabled={loading !== null}
        >
          {loading === "csv" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileText className="h-4 w-4" />
          )}
          <span className="ml-2">Export as CSV</span>
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => handleExport("excel")}
          disabled={loading !== null}
        >
          {loading === "excel" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <FileSpreadsheet className="h-4 w-4" />
          )}
          <span className="ml-2">Export as Excel</span>
        </Button>
      </div>
    </div>
  );
}
