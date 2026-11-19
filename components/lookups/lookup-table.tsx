import type { ReactNode } from "react";
import { ListTable } from "@/components/shared/list-layout";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LookupUsage } from "@/lib/lookups/queries";
import { cn } from "@/lib/utils";

export type LookupColumn = { label: string; align?: "right" };

// One row: its own cells, in the order of the columns, then where it is used.
export type LookupRow = { id: number; cells: ReactNode[]; usage: LookupUsage };

// The table of one lookup tab. Every tab ends with "Used by", which also
// says whether a row can be deleted.
export function LookupTable({
  columns,
  rows,
}: {
  columns: LookupColumn[];
  rows: LookupRow[];
}) {
  return (
    <ListTable>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead
              key={column.label}
              className={cn(column.align === "right" && "text-right")}
            >
              {column.label}
            </TableHead>
          ))}
          <TableHead>Used by</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {row.cells.map((cell, index) => (
              <TableCell
                key={columns[index].label}
                className={cn(
                  index === 0 && "font-medium",
                  columns[index].align === "right" && "text-right",
                )}
              >
                {cell}
              </TableCell>
            ))}
            <TableCell
              className={cn(!row.usage.inUse && "text-muted-foreground")}
            >
              {row.usage.label}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ListTable>
  );
}
