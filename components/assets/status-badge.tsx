import type { CSSProperties } from "react";
import { Badge } from "@/components/ui/badge";
import type { DisplayStatus } from "@/lib/assets/format";

// Status colors are admin-editable data, so the color is passed in as a CSS
// variable; all styling stays in the class names.
export function StatusBadge({ status }: { status: DisplayStatus }) {
  const colorVariable = { "--status-color": status.color } as CSSProperties;

  return (
    <Badge
      className="bg-(--status-color)/10 text-(--status-color)"
      style={colorVariable}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-(--status-color)" />
      {status.label}
    </Badge>
  );
}
