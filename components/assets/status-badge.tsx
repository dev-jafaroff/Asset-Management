import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import type { DisplayStatus } from "@/lib/assets/format";

// Status colors are admin-editable data, so the color is passed in as a CSS
// variable; all styling stays in the class names.
function statusColorVariable(color: string): CSSProperties {
  return { "--status-color": color } as CSSProperties;
}

export function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="size-1.5 shrink-0 rounded-full bg-(--status-color)"
      style={statusColorVariable(color)}
    />
  );
}

export function StatusBadge({ status }: { status: DisplayStatus }) {
  return (
    <Badge
      className="bg-(--status-color)/10 text-(--status-color)"
      style={statusColorVariable(status.color)}
    >
      <StatusDot color={status.color} />
      {status.label}
    </Badge>
  );
}
