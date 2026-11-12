"use client";

import type { ColumnVisibilityState } from "@tanstack/react-table";
import { Columns3, RotateCcw } from "lucide-react";
import { useMemo } from "react";
import {
  getColumnOptions,
  getDefaultColumnVisibility,
} from "@/components/assets/asset-columns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AssetType } from "@/lib/generated/prisma/enums";
import { useLocalStorage } from "@/hooks/use-local-storage";

function isColumnVisibilityState(
  value: unknown,
): value is ColumnVisibilityState {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((visible) => typeof visible === "boolean")
  );
}

export type AssetColumnVisibility = {
  visibility: ColumnVisibilityState;
  setColumnVisible: (id: string, visible: boolean) => void;
  // Back to the list's default columns.
  reset: () => void;
  // True once the user changed anything, so "Reset" is worth offering.
  isCustomized: boolean;
};

// Which columns one asset list shows. Kept per list in this browser for now
// (per user in the database once sign-in exists). The menu and the table both
// call this, and stay in sync through the shared storage key.
export function useAssetColumnVisibility(
  type?: AssetType,
): AssetColumnVisibility {
  const storage = useLocalStorage(
    `asset-columns:${type ?? "all"}`,
    isColumnVisibilityState,
  );
  const { value: saved, setValue, remove } = storage;

  // Defaults first, so a column added later still starts with its default.
  const visibility = useMemo(
    () => ({ ...getDefaultColumnVisibility(type), ...saved }),
    [type, saved],
  );

  return {
    visibility,
    setColumnVisible: (id, visible) =>
      setValue({ ...visibility, [id]: visible }),
    reset: remove,
    isCustomized: saved !== null,
  };
}

// "Columns" button above the table: shows or hides the list's columns.
export function ColumnMenu({ type }: { type?: AssetType }) {
  const { visibility, setColumnVisible, reset, isCustomized } =
    useAssetColumnVisibility(type);
  const options = getColumnOptions(type);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" size="sm">
            <Columns3 aria-hidden />
            Columns
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Show columns</DropdownMenuLabel>
          {options.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.id}
              checked={visibility[option.id] !== false}
              onCheckedChange={(checked) =>
                setColumnVisible(option.id, checked)
              }
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!isCustomized} onClick={reset}>
          <RotateCcw aria-hidden />
          Reset to default
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
