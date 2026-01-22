"use client";

import { ImportExportDialog } from "@/components/import-export";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background border-b">
      <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
        <h1 className="text-lg font-semibold">Spending Tracker</h1>
        <ImportExportDialog />
      </div>
    </header>
  );
}
