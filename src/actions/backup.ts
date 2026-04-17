"use server";

import { getBackupData, exportToCSV, exportToExcel } from "@/lib/backup";

export async function exportBackupCSV(): Promise<{ success: true; data: string; filename: string } | { error: string }> {
  try {
    const data = await getBackupData();
    const csv = exportToCSV(data);
    const base64 = Buffer.from(csv).toString("base64");
    const filename = `backup-${new Date().toISOString().split("T")[0]}.csv`;
    return { success: true, data: base64, filename };
  } catch (error) {
    console.error("Export CSV error:", error);
    return { error: "Failed to export backup" };
  }
}

export async function exportBackupExcel(): Promise<{ success: true; data: string; filename: string } | { error: string }> {
  try {
    const data = await getBackupData();
    const buffer = await exportToExcel(data);
    const base64 = buffer.toString("base64");
    const filename = `backup-${new Date().toISOString().split("T")[0]}.xlsx`;
    return { success: true, data: base64, filename };
  } catch (error) {
    console.error("Export Excel error:", error);
    return { error: "Failed to export backup" };
  }
}
