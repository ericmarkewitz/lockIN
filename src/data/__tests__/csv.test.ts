import { escapeCsvCell, toCsv } from '../csv';

describe('escapeCsvCell', () => {
  it('leaves plain values alone', () => {
    expect(escapeCsvCell('Bench Press')).toBe('Bench Press');
    expect(escapeCsvCell(135)).toBe('135');
  });
  it('renders null/undefined as empty', () => {
    expect(escapeCsvCell(null)).toBe('');
    expect(escapeCsvCell(undefined)).toBe('');
  });
  it('quotes commas, quotes and newlines', () => {
    expect(escapeCsvCell('a,b')).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell('line1\nline2')).toBe('"line1\nline2"');
  });
  it('neutralises spreadsheet formulas in text', () => {
    expect(escapeCsvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(escapeCsvCell('@cmd')).toBe("'@cmd");
    expect(escapeCsvCell('+1')).toBe("'+1");
  });
  it('does not mangle real negative numbers', () => {
    expect(escapeCsvCell(-5)).toBe('-5');
  });
  it('renders booleans as yes/no', () => {
    expect(escapeCsvCell(true)).toBe('yes');
    expect(escapeCsvCell(false)).toBe('no');
  });
});

describe('toCsv', () => {
  it('writes a header and rows in column order, CRLF separated', () => {
    const csv = toCsv([{ key: 'a', header: 'A' }, { key: 'b', header: 'B, ok' }], [{ a: 1, b: 'x' }, { a: 2, b: null }]);
    expect(csv).toBe('A,"B, ok"\r\n1,x\r\n2,\r\n');
  });
  it('writes only the header for no rows', () => {
    expect(toCsv([{ key: 'a', header: 'A' }], [])).toBe('A\r\n');
  });
});
