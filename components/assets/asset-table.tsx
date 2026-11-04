"use client";

import { useTable } from "@tanstack/react-table";
import {
  assetTableFeatures,
  getAssetColumns,
} from "@/components/assets/asset-columns";
import { AssetTypeIcon } from "@/components/assets/asset-icons";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AssetListItem } from "@/lib/assets/queries";
import type { AssetType } from "@/lib/generated/prisma/enums";

type AssetTableProps = {
  assets: AssetListItem[];
  // Omitted on "All assets": shows the generic column set.
  type?: AssetType;
};

export function AssetTable({ assets, type }: AssetTableProps) {
  const table = useTable({
    features: assetTableFeatures,
    columns: getAssetColumns(type),
    data: assets,
    getRowId: (asset) => String(asset.id),
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
          {table.getRowModel().rows.map((row) => (
            <TableRow key={row.id}>
              {row.getAllCells().map((cell, index) => {
                const content = <table.FlexRender cell={cell} />;

                return (
                  <TableCell key={cell.id}>
                    {/* The first column identifies the asset, so it carries the type icon. */}
                    {index === 0 ? (
                      <span className="flex items-center gap-2">
                        <AssetTypeIcon type={row.original.type} />
                        {content}
                      </span>
                    ) : (
                      content
                    )}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
