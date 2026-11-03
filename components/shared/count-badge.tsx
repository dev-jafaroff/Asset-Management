import { cn } from "@/lib/utils";

type CountBadgeProps = {
  count: number;
  isActive?: boolean;
  className?: string;
};

// Small number pill next to a tab or navigation label.
export function CountBadge({
  count,
  isActive = false,
  className,
}: CountBadgeProps) {
  return (
    <span
      className={cn(
        "rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums",
        isActive && "bg-primary/10 text-primary",
        className,
      )}
    >
      {count}
    </span>
  );
}
