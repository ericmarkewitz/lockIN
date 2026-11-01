/** Parses user-typed numeric text. Blank, invalid and negative input give null. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
