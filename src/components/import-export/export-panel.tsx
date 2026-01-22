"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Check, AlertCircle, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { exportToExcel } from "@/actions/excel";

interface ExportPanelProps {
  onClose: () => void;
}

export function ExportPanel({ onClose }: ExportPanelProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleExport() {
    setLoading(true);
    setError(null);

    const result = await exportToExcel();

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Trigger download
    const link = document.createElement("a");
    link.href = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.data}`;
    link.download = result.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSuccess(true);
    setLoading(false);

    setTimeout(() => {
      onClose();
    }, 1500);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Export all your accounts, categories, and transactions to an Excel
        file. The file will contain three sheets with all your data.
      </p>

      <div className="rounded-md bg-muted p-3 text-sm">
        <p className="font-medium mb-1">The export will include:</p>
        <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
          <li>All bank accounts with balances</li>
          <li>All categories (income and expense)</li>
          <li>All transactions with references</li>
        </ul>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <Check className="h-4 w-4" />
          <AlertDescription>Export successful! File downloaded.</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleExport}
        disabled={loading || success}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Exporting...
          </>
        ) : success ? (
          <>
            <Check className="h-4 w-4" />
            Exported
          </>
        ) : (
          <>
            <Download className="h-4 w-4" />
            Export to Excel
          </>
        )}
      </Button>
    </div>
  );
}
