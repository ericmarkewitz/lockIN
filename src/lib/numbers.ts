/** Parses user-typed numeric text. Blank, invalid and negative input give null. */
export function parseNumber(text: string): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d*\.?\d+$|^\d+\.$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const SCALES = [{ at: 1e6, suffix: 'M' }, { at: 1e3, suffix: 'k' }];

/** A big total at a glance: "3,480" below ten thousand, then "12.3k", "126k", "1.25M". Three significant digits. */
export function formatCompact(n: number): string {
  const whole = Math.round(n);
  if (whole < 10_000) return whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  for (const [i, { at, suffix }] of SCALES.entries()) {
    if (n < at) continue;
    const v = n / at;
    const rounded = Number(v.toPrecision(3));
    // 999.6k rounds to 1000k: show it in the next unit up.
    if (rounded >= 1000 && i > 0) return `${Number((rounded / 1000).toPrecision(3))}${SCALES[i - 1].suffix}`;
    return `${rounded}${suffix}`;
  }
  return whole.toString();
}
