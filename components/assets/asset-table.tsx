"use client";

import { useTable } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import {
  assetTableFeatures,
  getAssetColumns,
} from "@/components/assets/asset-columns";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import { useAssetColumnVisibility } from "@/components/assets/column-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAssetPath } from "@/lib/assets/asset-types";
import type { AssetListItem } from "@/lib/assets/queries";
import type { AssetType } from "@/lib/generated/prisma/enums";

type AssetTableProps = {
  assets: AssetListItem[];
  // Omitted on "All assets": shows the generic column set.
  type?: AssetType;
};

// The whole row opens the asset, like its link: Ctrl/⌘ + click or a middle
// click opens a new tab. The link in the first cell stays the way in for the
// keyboard and screen readers. Clicks on other controls, or while text is
// selected (e.g. copying a serial), are left alone.
function useRowNavigation() {
  const router = useRouter();

  function shouldIgnore(event: MouseEvent<HTMLElement>): boolean {
    const target = event.target as Element;
    return (
      target.closest("a, button, input, select, textarea") !== null ||
      Boolean(window.getSelection()?.toString())
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

export function AssetTable({ assets, type }: AssetTableProps) {
  const getRowLinkProps = useRowNavigation();
  const { visibility } = useAssetColumnVisibility(type);
  const table = useTable({
    features: assetTableFeatures,
    columns: getAssetColumns(type),
    data: assets,
    getRowId: (asset) => String(asset.id),
    // Owned by the column menu; the table only reads it.
    state: { columnVisibility: visibility },
  });

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
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

            return (
              <TableRow
                key={row.id}
                className="cursor-pointer"
                {...getRowLinkProps(href)}
              >
                {row.getVisibleCells().map((cell, index) => {
                  const content = <table.FlexRender cell={cell} />;

                  return (
                    <TableCell key={cell.id}>
                      {/* The first column identifies the asset: it carries the
                          type icon and the link to the detail page. */}
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
  );
}
