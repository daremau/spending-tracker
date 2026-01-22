"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  AlertCircle,
  Check,
  FileSpreadsheet,
  X,
  Loader2,
} from "lucide-react";
import { ImportOptions, ImportResult, ImportStrategy } from "@/lib/excel-types";
import { useRouter } from "next/navigation";

interface ImportPanelProps {
  onClose: () => void;
}

export function ImportPanel({ onClose }: ImportPanelProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [options, setOptions] = useState<ImportOptions>({
    accounts: "skip",
    categories: "skip",
    transactions: "skip",
  });
  const [isDragging, setIsDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (
      droppedFile &&
      (droppedFile.name.toLowerCase().endsWith(".xlsx") ||
        droppedFile.name.toLowerCase().endsWith(".xls"))
    ) {
      setFile(droppedFile);
      setError(null);
      setResult(null);
    } else {
      setError("Please upload an Excel file (.xlsx or .xls)");
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
    setProgress(0);
  };

  async function handleImport() {
    if (!file) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setProgress(10);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("options", JSON.stringify(options));

      setProgress(30);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
      });

      setProgress(70);

      const data = await response.json();

      if (!response.ok) {
        if (data.parseErrors) {
          const errorMessages = data.parseErrors
            .slice(0, 3)
            .map(
              (e: { sheet: string; row: number; message: string }) =>
                `Row ${e.row} in ${e.sheet}: ${e.message}`
            )
            .join("\n");
          setError(`Validation errors:\n${errorMessages}`);
        } else {
          setError(data.error || "Import failed");
        }
        setLoading(false);
        setProgress(0);
        return;
      }

      setProgress(100);
      setResult(data);
      router.refresh();
    } catch (err) {
      setError("Failed to import data");
    } finally {
      setLoading(false);
    }
  }

  const updateOption = (
    key: keyof ImportOptions,
    value: ImportStrategy
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      {/* File drop zone */}
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
          <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground mb-2">
            Drag and drop an Excel file here, or
          </p>
          <label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button variant="outline" size="sm" asChild>
              <span className="cursor-pointer">Browse files</span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground mt-2">
            Supports .xlsx and .xls files up to 10MB
          </p>
        </div>
      )}

      {/* Selected file */}
      {file && !result && (
        <div className="border rounded-lg p-3 flex items-center gap-3">
          <FileSpreadsheet className="h-8 w-8 text-green-600 shrink-0" />
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

      {/* Import options */}
      {file && !result && (
        <div className="space-y-3">
          <p className="text-sm font-medium">Duplicate handling:</p>
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Accounts</span>
              <Select
                value={options.accounts}
                onValueChange={(v) =>
                  updateOption("accounts", v as ImportStrategy)
                }
              >
                <SelectTrigger className="w-[120px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Categories</span>
              <Select
                value={options.categories}
                onValueChange={(v) =>
                  updateOption("categories", v as ImportStrategy)
                }
              >
                <SelectTrigger className="w-[120px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Transactions</span>
              <Select
                value={options.transactions}
                onValueChange={(v) =>
                  updateOption("transactions", v as ImportStrategy)
                }
              >
                <SelectTrigger className="w-[120px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="skip">Skip</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Progress */}
      {loading && (
        <div className="space-y-2">
          <Progress value={progress} />
          <p className="text-xs text-muted-foreground text-center">
            Importing data...
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="whitespace-pre-line">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>Import completed!</AlertDescription>
          </Alert>

          <div className="rounded-md bg-muted p-3 text-sm space-y-2">
            <div className="flex justify-between">
              <span>Accounts:</span>
              <span>
                {result.accounts.created} created, {result.accounts.skipped}{" "}
                skipped
              </span>
            </div>
            <div className="flex justify-between">
              <span>Categories:</span>
              <span>
                {result.categories.created} created, {result.categories.skipped}{" "}
                skipped
              </span>
            </div>
            <div className="flex justify-between">
              <span>Transactions:</span>
              <span>
                {result.transactions.created} created,{" "}
                {result.transactions.skipped} skipped
              </span>
            </div>
          </div>

          {(result.accounts.errors.length > 0 ||
            result.categories.errors.length > 0 ||
            result.transactions.errors.length > 0) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Some items could not be imported. Check the data and try again.
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}

      {/* Actions */}
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
              Import from Excel
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
