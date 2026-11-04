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
};

// Icon on a muted rounded square, used before items in tables and lists.
// Decorative: the item's name or type is always shown next to it.
export function IconTile({
  icon: Icon,
  size = "sm",
  className,
}: IconTileProps) {
  return (
    <span
      aria-hidden
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
