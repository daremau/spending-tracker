"use client";

import { ImportExportDialog } from "@/components/import-export";
import {
  CurrencySettingsDialog,
  type CurrencyConfiguration,
} from "@/components/settings/currency-settings-dialog";

export function Header({
  currencyConfiguration,
}: {
  currencyConfiguration: CurrencyConfiguration;
}) {
  return (
    <header className="sticky top-0 z-40 bg-background border-b">
      <div className="flex items-center gap-2 h-14 px-4 md:px-6">
        <h1 className="text-lg font-semibold md:hidden">Spending Tracker</h1>
        <div className="ml-auto flex items-center gap-2">
          <CurrencySettingsDialog configuration={currencyConfiguration} />
          <ImportExportDialog />
        </div>
      </div>
    </header>
  );
}
