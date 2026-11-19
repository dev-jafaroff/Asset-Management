import type { ReactNode } from "react";
import { deleteLookup, saveLookup } from "@/app/(app)/admin/lookups/actions";
import {
  DeleteLookupDialog,
  LookupDialog,
} from "@/components/lookups/lookup-dialog";
import { ListTable } from "@/components/shared/list-layout";
import {
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LookupUsage } from "@/lib/lookups/queries";
import type {
  LookupField,
  LookupSlug,
  LookupValues,
} from "@/lib/schemas/lookup";

// e.g. { label: "Assets", className: "text-right" }; the class goes on the
// header and on every cell of the column.
export type LookupColumn = { label: string; className?: string };

// One row: its cells in the order of the columns, what its edit dialog
// starts with (its name among them), and where it is used.
export type LookupRow = {
  id: number;
  cells: ReactNode[];
  values: LookupValues & { name: string };
  usage: LookupUsage;
};

// The dialog of a tab: what one row is called and the fields it has.
export type LookupForm = {
  slug: LookupSlug;
  noun: string;
  fields: LookupField[];
};

// The table of one lookup tab, with Edit and Delete at the end of each row.
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
            <TableCell>
              <div className="flex justify-end gap-1">
                <LookupDialog
                  noun={form.noun}
                  fields={form.fields}
                  values={row.values}
                  onSave={saveLookup.bind(null, form.slug, row.id)}
                />
                <DeleteLookupDialog
                  noun={form.noun}
                  name={row.values.name}
                  usedBy={row.usage.inUse ? row.usage.label : undefined}
                  onDelete={deleteLookup.bind(null, form.slug, row.id)}
                />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </ListTable>
  );
}
