"use server";

import { collectBackup, exportToCSV, exportToExcel } from "@/lib/backup";

type ExportResult =
  | { success: true; data: string; filename: string }
  | { error: string };

function filename(extension: string) {
  return `backup-v2-${new Date().toISOString().split("T")[0]}.${extension}`;
}

export async function exportBackupCSV(): Promise<ExportResult> {
  try {
    const backup = await collectBackup();
    const csv = exportToCSV(backup);
    return {
      success: true,
      data: Buffer.from(csv).toString("base64"),
      filename: filename("csv"),
    };
  } catch (error) {
    console.error("Export CSV error:", error);
    return { error: "Failed to export backup" };
  }
}

export async function exportBackupExcel(): Promise<ExportResult> {
  try {
    const backup = await collectBackup();
    const buffer = await exportToExcel(backup);
    return {
      success: true,
      data: buffer.toString("base64"),
      filename: filename("xlsx"),
    };
  } catch (error) {
    console.error("Export Excel error:", error);
    return { error: "Failed to export backup" };
  }
}
