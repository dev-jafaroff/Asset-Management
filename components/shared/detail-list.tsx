import { Fragment, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type DetailListItem = {
  label: string;
  // Empty values show a dash, so every row keeps its place.
  value: ReactNode;
  mono?: boolean;
};

function isEmpty(value: ReactNode): boolean {
  return value === null || value === undefined || value === "";
}

// Label / value rows of a detail card (asset, user, ...).
export function DetailList({ items }: { items: DetailListItem[] }) {
  return (
    <dl className="grid grid-cols-[minmax(6rem,8.5rem)_1fr] gap-x-6 gap-y-2.5">
      {items.map(({ label, value, mono }) => (
        <Fragment key={label}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd
            className={cn(
              "min-w-0 font-medium wrap-break-word",
              mono && "font-mono text-xs leading-5",
            )}
          >
            {isEmpty(value) ? (
              <span className="font-normal text-muted-foreground">—</span>
            ) : (
              value
            )}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}
