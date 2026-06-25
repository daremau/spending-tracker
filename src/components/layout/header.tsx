"use client";

import { ImportExportDialog } from "@/components/import-export";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background border-b">
      <div className="flex items-center gap-2 h-14 px-4 md:px-6">
        <h1 className="text-lg font-semibold md:hidden">Spending Tracker</h1>
        <div className="ml-auto">
          <ImportExportDialog />
        </div>
      </div>
    </header>
  );
}
