import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const tileSizes = {
  // 26px: table rows and compact lists.
  sm: "size-6.5 [&_svg]:size-3.5",
  // 30px: dashboard and detail lists.
  md: "size-7.5 [&_svg]:size-4",
};

export type IconTileSize = keyof typeof tileSizes;

type IconTileProps = {
  icon: LucideIcon;
  size?: IconTileSize;
  className?: string;
  // What the icon shows, e.g. "Laptop"; it appears on hover.
  label?: string;
};

// Icon on a muted rounded square, used before items in tables and lists.
// Hidden from screen readers: the item's name or type is always shown next
// to it, and `label` is only a hover hint.
export function IconTile({
  icon: Icon,
  size = "sm",
  className,
  label,
}: IconTileProps) {
  return (
    <span
      aria-hidden
      title={label}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground",
        tileSizes[size],
        className,
      )}
    >
      <Icon />
    </span>
  );
}
