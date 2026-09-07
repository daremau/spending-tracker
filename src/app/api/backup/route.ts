import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  collectBackup,
  exportToCSV,
  exportToExcel,
  parseCSV,
  parseExcel,
  restoreBackup,
} from "@/lib/backup";

export const dynamic = "force-dynamic";

function exportFilename(extension: string) {
  return `backup-v2-${new Date().toISOString().split("T")[0]}.${extension}`;
}

// Export is a read, so it is served over GET (a plain file download).
// The previous Server Action flight-POST never reached the server through
// some preview proxies, surfacing only as "Failed to export backup".
export async function GET(request: NextRequest) {
  try {
    const format =
      new URL(request.url).searchParams.get("format")?.toLowerCase() ===
      "excel"
        ? "excel"
        : "csv";
    const backup = await collectBackup();

    if (format === "excel") {
      const buffer = await exportToExcel(backup);
      return new NextResponse(new Uint8Array(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${exportFilename("xlsx")}"`,
        },
      });
    }

    return new NextResponse(exportToCSV(backup), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename("csv")}"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export backup" },
      { status: 500 }
    );
  }
}

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
