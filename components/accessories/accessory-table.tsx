"use client";

import Link from "next/link";
import { AccessoryIcon } from "@/components/assets/asset-icons";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useRowNavigation } from "@/hooks/use-row-navigation";
import type { AccessoryListItem } from "@/lib/accessories/queries";

// The link is built on the server, so this file stays free of database code.
export type AccessoryRow = AccessoryListItem & { href: string };

// Accessories with their stock; a row opens the accessory.
export function AccessoryTable({
  accessories,
}: {
  accessories: AccessoryRow[];
}) {
  const getRowLinkProps = useRowNavigation();

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Category</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="text-right">Assigned</TableHead>
            <TableHead className="text-right">In stock</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {accessories.map((accessory) => {
            const { href, stock } = accessory;

            return (
              <TableRow
                key={accessory.id}
                className="cursor-pointer"
                {...getRowLinkProps(href)}
              >
                <TableCell>
                  <Link
                    href={href}
                    className="flex w-fit items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <AccessoryIcon iconKey={accessory.category.icon} />
                    {accessory.name}
                  </Link>
                </TableCell>
                <TableCell>{accessory.category.name}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {stock.total}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {stock.assigned}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {stock.inStock > 0 ? (
                    stock.inStock
                  ) : (
                    <Badge variant="destructive">Out of stock</Badge>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
