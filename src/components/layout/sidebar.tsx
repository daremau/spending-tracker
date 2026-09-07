"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { getDesktopNavItems, isNavActive } from "./nav-items";

export function Sidebar({ portfolioEnabled }: { portfolioEnabled: boolean }) {
  const pathname = usePathname();
  const navItems = getDesktopNavItems(portfolioEnabled);

  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 z-50 w-60 flex-col border-r bg-background">
      <div className="flex h-14 items-center px-6 border-b">
        <h1 className="text-lg font-semibold">Spending Tracker</h1>
      </div>
      <nav aria-label="Primary" className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active = isNavActive(item.href, pathname);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                active
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
