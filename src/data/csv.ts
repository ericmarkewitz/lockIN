export type CsvColumn = { key: string; header: string };

/** RFC 4180 quoting plus a guard against spreadsheet formula injection in text cells. */
export function escapeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number') return String(value);
  let s = String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns: CsvColumn[], rows: Record<string, unknown>[]): string {
  const lines = [columns.map((c) => escapeCsvCell(c.header)).join(',')];
  for (const row of rows) lines.push(columns.map((c) => escapeCsvCell(row[c.key])).join(','));
  return lines.join('\r\n') + '\r\n';
}
