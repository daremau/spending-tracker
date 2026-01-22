import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseExcelFile } from "@/lib/excel-parser";
import { importData } from "@/lib/excel-importer";
import { ImportOptions } from "@/lib/excel-types";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const optionsStr = formData.get("options") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith(".xlsx") && !fileName.endsWith(".xls")) {
      return NextResponse.json(
        { error: "Invalid file type. Please upload an Excel file (.xlsx or .xls)" },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 400 }
      );
    }

    const options: ImportOptions = optionsStr
      ? JSON.parse(optionsStr)
      : { accounts: "skip", categories: "skip", transactions: "skip" };

    // Parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseExcelFile(buffer);

    // Check for parse errors
    if (parsed.errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          parseErrors: parsed.errors,
          message: "File contains validation errors. Please fix them and try again.",
        },
        { status: 400 }
      );
    }

    // Import data
    const result = await importData(parsed, options);

    // Revalidate paths to refresh the UI
    revalidatePath("/");
    revalidatePath("/accounts");
    revalidatePath("/transactions");
    revalidatePath("/analytics");

    return NextResponse.json(result);
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import data. Please check the file format." },
      { status: 500 }
    );
  }
}
