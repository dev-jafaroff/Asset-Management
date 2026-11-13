"use client";

import { useTable, type RowSelectionState } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import {
  assetTableFeatures,
  getAssetColumns,
} from "@/components/assets/asset-columns";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import { BulkActionBar } from "@/components/assets/bulk-action-bar";
import { useAssetColumnVisibility } from "@/components/assets/column-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { BulkActionOptions } from "@/lib/assets/asset-form-options";
import { getAssetPath } from "@/lib/assets/asset-types";
import { getAssetDisplayName } from "@/lib/assets/format";
import type { AssetListItem } from "@/lib/assets/queries";
import type { AssetType } from "@/lib/generated/prisma/enums";

type AssetTableProps = {
  assets: AssetListItem[];
  // Omitted on "All assets": shows the generic column set.
  type?: AssetType;
  // The lists of the bulk action dialogs; only given to people who may edit,
  // and without it rows cannot be selected.
  bulkOptions?: BulkActionOptions;
};

// The whole row opens the asset, like its link: Ctrl/⌘ + click or a middle
// click opens a new tab. The link in the first cell stays the way in for the
// keyboard and screen readers. Clicks on other controls (e.g. the selection
// checkbox), or while text is selected (e.g. copying a serial), are left alone.
function useRowNavigation() {
  const router = useRouter();

  function shouldIgnore(event: MouseEvent<HTMLElement>): boolean {
    const target = event.target as Element;
    return (
      target.closest(
        "a, button, input, select, textarea, [role='checkbox']",
      ) !== null || Boolean(window.getSelection()?.toString())
    );
  }

  return (href: string) => ({
    onClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (shouldIgnore(event)) return;
      if (event.ctrlKey || event.metaKey) window.open(href, "_blank");
      else router.push(href);
    },
    onAuxClick: (event: MouseEvent<HTMLTableRowElement>) => {
      if (event.button !== 1 || shouldIgnore(event)) return;
      window.open(href, "_blank");
    },
  });
}

// The selected rows, by asset id. A selection belongs to the rows on screen:
// another page, tab or filter, or a reload after an action, starts empty.
function useRowSelection(assets: AssetListItem[]) {
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectedFrom, setSelectedFrom] = useState(assets);
  if (selectedFrom !== assets) {
    setSelectedFrom(assets);
    setRowSelection({});
  }
  return [rowSelection, setRowSelection] as const;
}

export function AssetTable({ assets, type, bulkOptions }: AssetTableProps) {
  const getRowLinkProps = useRowNavigation();
  const { visibility } = useAssetColumnVisibility(type);
  const [rowSelection, setRowSelection] = useRowSelection(assets);
  const selectable = bulkOptions !== undefined;
  const table = useTable({
    features: assetTableFeatures,
    columns: getAssetColumns(type),
    data: assets,
    getRowId: (asset) => String(asset.id),
    enableRowSelection: selectable,
    onRowSelectionChange: setRowSelection,
    // Visibility is owned by the column menu; the table only reads it.
    state: { columnVisibility: visibility, rowSelection },
  });

  const selected = table.getSelectedRowModel().rows.map((row) => row.original);

  return (
    <div className="flex flex-col gap-2">
      {selectable && (
        <BulkActionBar
          selected={selected}
          options={bulkOptions}
          onClear={() => table.resetRowSelection()}
        />
      )}

      <div className="overflow-hidden rounded-lg border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {/* Kept out of the column set, so the column menu and the
                    "first column links to the asset" rule ignore it. */}
                {selectable && (
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all assets on this page"
                      checked={table.getIsAllPageRowsSelected()}
                      indeterminate={table.getIsSomePageRowsSelected()}
                      onCheckedChange={(checked) =>
                        table.toggleAllPageRowsSelected(checked)
                      }
                    />
                  </TableHead>
                )}
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {!header.isPlaceholder && (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody>
            {table.getRowModel().rows.map((row) => {
              const href = getAssetPath(row.original.type, row.original.id);
              const isSelected = row.getIsSelected();

              return (
                <TableRow
                  key={row.id}
                  data-state={isSelected ? "selected" : undefined}
                  className="cursor-pointer"
                  {...getRowLinkProps(href)}
                >
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select ${getAssetDisplayName(row.original)}`}
                        checked={isSelected}
                        onCheckedChange={(checked) =>
                          row.toggleSelected(checked)
                        }
                      />
                    </TableCell>
                  )}
                  {row.getVisibleCells().map((cell, index) => {
                    const content = <table.FlexRender cell={cell} />;

                    return (
                      <TableCell key={cell.id}>
                        {/* The first column identifies the asset: it carries
                            the type icon and the link to the detail page. */}
                        {index === 0 ? (
                          <Link
                            href={href}
                            className="flex w-fit items-center gap-2 font-medium text-primary hover:underline"
                          >
                            <AssetTypeIcon type={row.original.type} />
                            {content}
                          </Link>
                        ) : (
                          content
                        )}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
