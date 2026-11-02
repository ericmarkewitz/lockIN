import type { WeightUnit } from '@/data/settings';

/** Weights are stored in pounds. These convert at the edges (display, entry, export). */
const LB_PER_KG = 2.20462262185;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stored pounds -> the user's unit, rounded to 2 decimals for display. */
export function toDisplayWeight(lb: number | null, unit: WeightUnit): number | null {
  if (lb === null) return null;
  return unit === 'kg' ? round2(lb / LB_PER_KG) : lb;
}

/** A value typed in the user's unit -> pounds, at full precision so kg entries round-trip. */
export function fromDisplayWeight(value: number | null, unit: WeightUnit): number | null {
  if (value === null) return null;
  return unit === 'kg' ? value * LB_PER_KG : value;
}
