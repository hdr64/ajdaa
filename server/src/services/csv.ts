import type { FastifyReply } from 'fastify';

export function escapeCsvCell(value: string | null | undefined): string {
  if (value == null) return '';
  let str = String(value);

  // CSV/formula-injection defense: prefix a single quote to any cell starting with = + - @ TAB or CR
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // RFC 4180 quoting: quote fields containing comma, quote, CR/LF; double inner quotes
  if (/[",\r\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }

  return str;
}

export type CsvCell = string | number | boolean | null | undefined;
export type CsvRow = ReadonlyArray<CsvCell>;

/**
 * Renders a whole CSV document: a UTF-8 BOM (so Excel picks the encoding up),
 * the header line, then one CRLF-terminated line per row. Cells are escaped
 * here, so callers hand over raw database values.
 */
export function buildCsv(headers: readonly string[], rows: ReadonlyArray<CsvRow>): string {
  const lines = [headers.map((header) => escapeCsvCell(header)).join(',')];

  for (const row of rows) {
    lines.push(row.map((cell) => escapeCsvCell(cell == null ? '' : String(cell))).join(','));
  }

  return '\uFEFF' + lines.join('\r\n') + '\r\n';
}

/** Streams a document built by `buildCsv` as a dated attachment. */
export function sendCsv(reply: FastifyReply, baseName: string, csv: string): FastifyReply {
  const date = new Date().toISOString().slice(0, 10);
  reply.header('Content-Type', 'text/csv; charset=utf-8');
  reply.header('Content-Disposition', `attachment; filename="${baseName}-${date}.csv"`);

  return reply.send(csv);
}
