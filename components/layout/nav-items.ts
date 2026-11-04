import {
  House,
  Keyboard,
  KeyRound,
  LayoutGrid,
  Package,
  RefreshCw,
  ScanLine,
  Tags,
  Users,
  type LucideIcon,
} from "lucide-react";
import { assetTypeIcons } from "@/components/assets/asset-icons";
import {
  ASSETS_PATH,
  assetTypeConfigs,
  getAssetTypePath,
} from "@/lib/assets/asset-types";
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
        basePath: ASSETS_PATH,
        items: [
          {
            label: "All assets",
            href: ASSETS_PATH,
            icon: LayoutGrid,
            exact: true,
          },
          // One link per asset type, so a new type shows up here by itself.
          ...assetTypeConfigs.map((config) => ({
            label: config.label,
            href: getAssetTypePath(config.slug),
            icon: assetTypeIcons[config.type],
          })),
          {
            label: "Accessories",
            href: `${ASSETS_PATH}/accessories`,
            icon: Keyboard,
          },
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
