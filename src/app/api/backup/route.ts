import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseCSV, parseExcel, restoreBackup } from "@/lib/backup";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const buffer = Buffer.from(await file.arrayBuffer());

    let parsed;
    if (fileName.endsWith(".csv")) {
      parsed = parseCSV(buffer.toString("utf-8"));
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      parsed = await parseExcel(buffer);
    } else {
      return NextResponse.json(
        { error: "Invalid file type. Use .csv, .xlsx, or .xls" },
        { status: 400 }
      );
    }

    if (parsed.errors.length > 0) {
      return NextResponse.json(
        { success: false, errors: parsed.errors },
        { status: 400 }
      );
    }

    // restoreBackup runs preflight first and only deletes once the whole file
    // validates, so a rejected import leaves the existing data in place.
    const result = await restoreBackup(parsed.backup);
    if (!result.success) {
      return NextResponse.json(
        { success: false, errors: result.errors },
        { status: 400 }
      );
    }

    revalidatePath("/");
    revalidatePath("/accounts");
    revalidatePath("/transactions");
    revalidatePath("/analytics");
    revalidatePath("/portfolio");

    return NextResponse.json({ ...result, sourceVersion: parsed.sourceVersion });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: "Failed to import backup" },
      { status: 500 }
    );
  }
}
