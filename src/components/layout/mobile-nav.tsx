"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tags,
  BarChart3,
} from "lucide-react";

const navItems = [
  {
    href: "/",
    label: "Home",
    icon: LayoutDashboard,
  },
  {
    href: "/accounts",
    label: "Accounts",
    icon: Wallet,
  },
  {
    href: "/transactions",
    label: "Txns",
    icon: ArrowLeftRight,
  },
  {
    href: "/categories",
    label: "Categories",
    icon: Tags,
  },
  {
    href: "/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full text-xs transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
