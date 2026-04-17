"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, FileSpreadsheet, Loader2 } from "lucide-react";
import { exportBackupCSV, exportBackupExcel } from "@/actions/backup";

export function ExportPanel({ onClose }: { onClose: () => void }) {
  const [loading, setLoading] = useState<"csv" | "excel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleExport(format: "csv" | "excel") {
    setLoading(format);
    setError(null);

    try {
      const result = format === "csv" ? await exportBackupCSV() : await exportBackupExcel();

      if ("error" in result) {
        setError(result.error);
      } else {
        const link = document.createElement("a");
        link.href = `data:application/${format === "csv" ? "csv" : "vnd.openxmlformats-officedocument.spreadsheetml.sheet"};base64,${result.data}`;
        link.download = result.filename;
        link.click();
        onClose();
      }
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
