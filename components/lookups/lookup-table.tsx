import type { ReactNode } from "react";
import { saveLookup } from "@/app/(app)/admin/lookups/actions";
import { LookupDialog } from "@/components/lookups/lookup-dialog";
import { ListTable } from "@/components/shared/list-layout";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  LookupField,
  LookupSlug,
  LookupValues,
} from "@/lib/schemas/lookup";

// e.g. { label: "Assets", className: "text-right" }; the class goes on the
// header and on every cell of the column.
export type LookupColumn = { label: string; className?: string };

// One row: its cells in the order of the columns, and what its edit dialog
// starts with.
export type LookupRow = {
  id: number;
  cells: ReactNode[];
  values: LookupValues;
};

// The dialog of a tab: what one row is called and the fields it has.
export type LookupForm = {
  slug: LookupSlug;
  noun: string;
  fields: LookupField[];
};

// The table of one lookup tab, with Edit at the end of each row.
export function LookupTable({
  columns,
  rows,
  form,
}: {
  columns: LookupColumn[];
  rows: LookupRow[];
  form: LookupForm;
}) {
  return (
    <ListTable>
      <TableHeader>
        <TableRow>
          {columns.map((column) => (
            <TableHead key={column.label} className={column.className}>
              {column.label}
            </TableHead>
          ))}
          <TableHead className="w-px">
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.id}>
            {row.cells.map((cell, index) => (
              <TableCell
                key={columns[index].label}
                className={columns[index].className}
              >
                {cell}
              </TableCell>
            ))}
            <TableCell className="text-right">
              <LookupDialog
                noun={form.noun}
                fields={form.fields}
                values={row.values}
                onSave={saveLookup.bind(null, form.slug, row.id)}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ListTable>
  );
}
