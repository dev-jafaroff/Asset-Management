import type { ReactNode } from "react";
import { Table } from "@/components/ui/table";

// A list page (assets, users, accessories) that fills the screen: the page
// header, search, tabs and selection bar stay in place, and only the rows
// scroll, inside the ListTable below.
export function ListPage({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-0 flex-col">{children}</div>;
}

// The table of a ListPage. Its box is the scroll area, in both directions,
// so the column names stay on top while the rows move under them. The
// header's line is a shadow: a border would scroll away with the rows.
const listTableClassName = [
  "min-h-0 overflow-auto rounded-lg border bg-card",
  "[&_thead]:sticky [&_thead]:top-0 [&_thead]:z-10",
  "[&_thead_tr]:border-b-0 [&_th]:bg-card",
  "[&_th]:shadow-[inset_0_-1px_0_var(--border)]",
].join(" ");

export function ListTable({ children }: { children: ReactNode }) {
  return <Table containerClassName={listTableClassName}>{children}</Table>;
}
