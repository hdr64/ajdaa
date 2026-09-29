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
