import type { DistanceUnit, WeightUnit } from '@/data/settings';

/**
 * Weights are stored in pounds and distances in miles. These convert at the edges
 * (display, entry, export). Distances logged before units existed are read as miles.
 */
const LB_PER_KG = 2.20462262185;
const KM_PER_MI = 1.609344;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Stored pounds -> the user's unit, rounded to 2 decimals for display. */
export function toDisplayWeight(lb: number | null, unit: WeightUnit): number | null {
  if (lb === null) return null;
  return round2(unit === 'kg' ? lb / LB_PER_KG : lb);
}

/** A value typed in the user's unit -> pounds, at full precision so kg entries round-trip. */
export function fromDisplayWeight(value: number | null, unit: WeightUnit): number | null {
  if (value === null) return null;
  return unit === 'kg' ? value * LB_PER_KG : value;
}

/** Stored miles -> the user's unit, rounded to 2 decimals for display. */
export function toDisplayDistance(mi: number | null, unit: DistanceUnit): number | null {
  if (mi === null) return null;
  return round2(unit === 'km' ? mi * KM_PER_MI : mi);
}

/** A value entered in the user's unit -> miles, at full precision so km entries round-trip. */
export function fromDisplayDistance(value: number | null, unit: DistanceUnit): number | null {
  if (value === null) return null;
  return unit === 'km' ? value / KM_PER_MI : value;
}

/** "3.1 mi"; blank for no distance. */
export function formatDistance(mi: number | null, unit: DistanceUnit): string {
  const n = toDisplayDistance(mi, unit);
  return n === null ? '' : `${n} ${unit}`;
}

export const otherWeightUnit = (u: WeightUnit): WeightUnit => (u === 'lb' ? 'kg' : 'lb');
export const otherDistanceUnit = (u: DistanceUnit): DistanceUnit => (u === 'mi' ? 'km' : 'mi');
