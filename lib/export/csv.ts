import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { formatSortableDate } from "@/lib/utils";

// Written for Excel in the office locale (Azerbaijani, Russian), so a double
// click opens the file in columns: there the list separator is ";" and
// decimals use ",".
const DELIMITER = ";";
const DECIMAL_SEPARATOR = ",";
const LINE_BREAK = "\r\n";
// Byte order mark: tells Excel the file is UTF-8, so "ə" and "ş" show right.
const BYTE_ORDER_MARK = "﻿";

export type CsvValue = string | number | null | undefined;

export type CsvColumn<Row> = {
  header: string;
  value: (row: Row) => CsvValue;
};

export type CsvTable<Row> = {
  columns: readonly CsvColumn<Row>[];
  rows: readonly Row[];
};

// Text a spreadsheet would run as a formula, e.g. "=HYPERLINK(…)" typed into
// a note. Plain numbers such as "+994501234567" or "-5" cannot do anything,
// so they stay as they are.
const formulaStart = /^[=+\-@\t\r]/;
const plainNumber = /^[+-]?[\d\s().-]*$/;
// A cell holding any of these is quoted, so it stays one cell.
const needsQuotes = new RegExp(`["${DELIMITER}\r\n]`);

function toCell(value: CsvValue): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") {
    return String(value).replace(".", DECIMAL_SEPARATOR);
  }
  const text =
    formulaStart.test(value) && !plainNumber.test(value) ? `'${value}` : value;
  return needsQuotes.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

// The header row, then one line per row.
export function toCsv<Row>({ columns, rows }: CsvTable<Row>): string {
  const lines = [
    columns.map((column) => toCell(column.header)),
    ...rows.map((row) => columns.map((column) => toCell(column.value(row)))),
  ];
  return (
    BYTE_ORDER_MARK +
    lines.map((cells) => cells.join(DELIMITER)).join(LINE_BREAK) +
    LINE_BREAK
  );
}

// A download named after the list and today, e.g. "pcs-2026-11-20.csv".
function csvDownload(name: string, csv: string): Response {
  const filename = `${name}-${formatSortableDate(new Date())}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// The response of an export route: the table `load` returns, as a file, for
// people who may export lists. `name` is a plain slug, e.g. "users".
export async function exportCsv<Row>(
  name: string,
  load: () => Promise<CsvTable<Row>>,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!can(user.role, "list:export")) {
    return new Response("You cannot export lists.", { status: 403 });
  }
  return csvDownload(name, toCsv(await load()));
}
