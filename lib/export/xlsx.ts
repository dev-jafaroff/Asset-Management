import { Workbook } from "exceljs";
import { getCurrentUser } from "@/lib/current-user";
import { can } from "@/lib/permissions";
import { formatSortableDate, formatSortableDateTime } from "@/lib/utils";

// Text stays text (serials keep their leading zeros, phone numbers their
// "+"), numbers and dates stay numbers and dates, so the file can be sorted,
// filtered and summed. Nothing is ever read as a formula.
export type ExportValue = string | number | Date | null | undefined;

// How a number or date column is shown. Excel shows "1,559.79" or
// "1 559,79" by the reader's own locale.
type ExportFormat = "date" | "dateTime" | "money";

export type ExportColumn<Row> = {
  header: string;
  value: (row: Row) => ExportValue;
  format?: ExportFormat;
};

export type ExportTable<Row> = {
  columns: readonly ExportColumn<Row>[];
  rows: readonly Row[];
};

export type ExportFile = {
  // A plain slug that names the file, e.g. "pcs" → "pcs-2026-11-20.xlsx".
  name: string;
  // The sheet's name in Excel, e.g. "PCs".
  sheet: string;
};

const formats: Record<ExportFormat, { numFmt: string; width: number }> = {
  date: { numFmt: "yyyy-mm-dd", width: 12 },
  dateTime: { numFmt: "yyyy-mm-dd hh:mm", width: 17 },
  money: { numFmt: "#,##0.00", width: 12 },
};

const MIN_WIDTH = 8;
const MAX_WIDTH = 50;

// Excel dates have no time zone, so a moment is written as the office's
// clock showed it, e.g. 07:31 UTC as 11:31 in Baku.
function toOfficeTime(date: Date): Date {
  return new Date(`${formatSortableDateTime(date).replace(" ", "T")}:00Z`);
}

function toCell(value: ExportValue, format?: ExportFormat) {
  if (value === undefined) return null;
  // A "date" is a calendar day, stored at midnight UTC: written as it is.
  if (value instanceof Date && format === "dateTime") {
    return toOfficeTime(value);
  }
  return value;
}

// Wide enough for the header and the longest value, within limits.
function getWidth<Row>(column: ExportColumn<Row>, rows: readonly Row[]) {
  const longest = Math.max(
    column.header.length,
    column.format ? formats[column.format].width : 0,
    ...rows.map((row) => {
      const value = column.value(row);
      return value instanceof Date ? 0 : String(value ?? "").length;
    }),
  );
  return Math.min(Math.max(longest + 2, MIN_WIDTH), MAX_WIDTH);
}

// One sheet: a bold header row that stays in view, with filter buttons.
async function toXlsx<Row>(
  sheetName: string,
  { columns, rows }: ExportTable<Row>,
) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  sheet.columns = columns.map((column) => ({
    header: column.header,
    width: getWidth(column, rows),
    style: column.format ? { numFmt: formats[column.format].numFmt } : {},
  }));
  sheet.addRows(
    rows.map((row) =>
      columns.map((column) => toCell(column.value(row), column.format)),
    ),
  );
  sheet.getRow(1).font = { bold: true };
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  return workbook.xlsx.writeBuffer();
}

// The response of an export route: the table `load` returns, as an Excel
// file, for people who may export lists.
export async function exportXlsx<Row>(
  file: ExportFile,
  load: () => Promise<ExportTable<Row>>,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!can(user.role, "list:export")) {
    return new Response("You cannot export lists.", { status: 403 });
  }

  const filename = `${file.name}-${formatSortableDate(new Date())}.xlsx`;
  return new Response(await toXlsx(file.sheet, await load()), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
