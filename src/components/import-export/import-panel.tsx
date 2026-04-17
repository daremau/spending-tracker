"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  AlertCircle,
  Check,
  FileSpreadsheet,
  FileText,
  X,
  Loader2,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface ImportResult {
  success: boolean;
  accountsCreated: number;
  categoriesCreated: number;
  transactionsCreated: number;
  errors: string[];
}

export function ImportPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setError(null);
    setResult(null);
  };

  async function handleImport() {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/backup", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Import failed");
      } else if (!data.success) {
        setError(data.errors?.join("\n") || "Import failed");
      } else {
        setResult(data);
        router.refresh();
      }
    } catch {
      setError("Failed to import backup");
    } finally {
      setLoading(false);
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const isCSV = file?.name.toLowerCase().endsWith(".csv");

  return (
    <div className="space-y-4">
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          This will replace ALL existing data with the backup file contents.
        </AlertDescription>
      </Alert>

      {!file && !result && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
          }`}
        >
          {isCSV ? (
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          ) : (
            <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          )}
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop a backup file here, or
          </p>
          <label>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">Browse files</span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-2">
            Supports .csv, .xlsx, and .xls files
          </p>
        </div>
      )}

      {file && !result && (
        <div className="border rounded-lg p-3 flex items-center gap-3">
          {isCSV ? (
            <FileText className="h-8 w-8 text-green-600 shrink-0" />
          ) : (
            <FileSpreadsheet className="h-8 w-8 text-green-600 shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{file.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatSize(file.size)}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={clearFile}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {result && (
        <div className="space-y-3">
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>Backup restored successfully!</AlertDescription>
          </Alert>

          <div className="rounded-md bg-muted p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span>Accounts:</span>
              <span>{result.accountsCreated} created</span>
            </div>
            <div className="flex justify-between">
              <span>Categories:</span>
              <span>{result.categoriesCreated} created</span>
            </div>
            <div className="flex justify-between">
              <span>Transactions:</span>
              <span>{result.transactionsCreated} created</span>
            </div>
            {result.errors.length > 0 && (
              <div className="mt-2 pt-2 border-t text-destructive">
                {result.errors.length} errors
              </div>
            )}
          </div>
        </div>
      )}

      {!result ? (
        <Button
          onClick={handleImport}
          disabled={!file || loading}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4" />
              Import Backup
            </>
          )}
        </Button>
      ) : (
        <Button onClick={onClose} className="w-full">
          Done
        </Button>
      )}
    </div>
  );
}
