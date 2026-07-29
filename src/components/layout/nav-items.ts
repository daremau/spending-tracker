import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  Tags,
  BarChart3,
  BriefcaseBusiness,
  Menu,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const baseNavItems: NavItem[] = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/accounts", label: "Accounts", icon: Wallet },
  { href: "/transactions", label: "Txns", icon: ArrowLeftRight },
];

const secondaryNavItems: NavItem[] = [
  { href: "/categories", label: "Categories", icon: Tags },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
];

export function getDesktopNavItems(portfolioEnabled: boolean): NavItem[] {
  return portfolioEnabled
    ? [
        ...baseNavItems,
        { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
        ...secondaryNavItems,
      ]
    : [...baseNavItems, ...secondaryNavItems];
}

export function getMobileNavItems(portfolioEnabled: boolean): NavItem[] {
  return portfolioEnabled
    ? [
        ...baseNavItems,
        { href: "/portfolio", label: "Portfolio", icon: BriefcaseBusiness },
        { href: "/more", label: "More", icon: Menu },
      ]
    : [...baseNavItems, ...secondaryNavItems];
}

export function isNavActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}
