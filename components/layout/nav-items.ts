import {
  House,
  Keyboard,
  KeyRound,
  Laptop,
  LayoutGrid,
  Monitor,
  Package,
  Printer,
  RefreshCw,
  ScanLine,
  Server,
  Smartphone,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/current-user";

export type NavLinkItem = {
  label: string;
  href: string;
  icon?: LucideIcon;
  exact?: boolean;
};

export type NavGroupItem = {
  label: string;
  icon: LucideIcon;
  basePath: string;
  items: NavLinkItem[];
};

export type NavItem = NavLinkItem | NavGroupItem;

export type NavSection = {
  title?: string;
  roles?: Role[];
  items: NavItem[];
};

export function isNavGroup(item: NavItem): item is NavGroupItem {
  return "items" in item;
}

export const navSections: NavSection[] = [
  {
    items: [
      { label: "Home", href: "/", icon: House },
      { label: "Users", href: "/users", icon: Users },
      {
        label: "Assets",
        icon: Package,
        basePath: "/assets",
        items: [
          {
            label: "All assets",
            href: "/assets",
            icon: LayoutGrid,
            exact: true,
          },
          { label: "PCs", href: "/assets/pcs", icon: Laptop },
          { label: "Monitors", href: "/assets/monitors", icon: Monitor },
          {
            label: "Accessories",
            href: "/assets/accessories",
            icon: Keyboard,
          },
          { label: "Printers", href: "/assets/printers", icon: Printer },
          { label: "Phones", href: "/assets/phones", icon: Smartphone },
          { label: "Virtual machines", href: "/assets/vms", icon: Server },
        ],
      },
      { label: "Licenses", href: "/licenses", icon: KeyRound },
      { label: "Scan", href: "/scan", icon: ScanLine },
    ],
  },
  {
    title: "Admin",
    roles: ["ADMIN"],
    items: [
      { label: "Lookup tables", href: "/admin/lookups", icon: Tags },
      { label: "Intune sync", href: "/admin/sync", icon: RefreshCw },
    ],
  },
];
