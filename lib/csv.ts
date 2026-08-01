// Hand-rolled rather than a dependency — the format needed is a single flat
// table with no nested structures, so RFC 4180 quoting is ~10 lines.
export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number | boolean | null;
};

function escapeCell(value: string | number | boolean | null): string {
  if (value === null) return "";
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) => columns.map((c) => escapeCell(c.value(row))).join(","));
  // CRLF per RFC 4180; a leading BOM so Excel opens UTF-8 (site names, etc.) correctly.
  return "﻿" + [header, ...lines].join("\r\n") + "\r\n";
}
