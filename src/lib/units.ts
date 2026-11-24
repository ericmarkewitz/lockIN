import type { DistanceUnit, WeightUnit } from '@/data/settings';

/**
 * Weights are stored in pounds, distances in miles and elevation in feet. These convert at the
 * edges (display, entry, export). Distances logged before units existed are read as miles.
 *
 * A short distance (a swim, a row, a carry) is stored in miles too, and shown in yards with the
 * mi setting or meters with km; elevation is shown in feet or meters the same way.
 */
const LB_PER_KG = 2.20462262185;
const KM_PER_MI = 1.609344;
const YD_PER_MI = 1760;
const M_PER_MI = KM_PER_MI * 1000;
const M_PER_FT = 0.3048;

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

export const shortDistanceUnit = (u: DistanceUnit) => (u === 'mi' ? 'yd' : 'm');
export const elevationUnit = (u: DistanceUnit) => (u === 'mi' ? 'ft' : 'm');

/** Stored miles -> yards or meters, rounded to 2 decimals for display. */
export function toDisplayShortDistance(mi: number | null, unit: DistanceUnit): number | null {
  if (mi === null) return null;
  return round2(mi * (unit === 'km' ? M_PER_MI : YD_PER_MI));
}

/** Yards or meters as typed -> miles, at full precision. */
export function fromDisplayShortDistance(value: number | null, unit: DistanceUnit): number | null {
  if (value === null) return null;
  return value / (unit === 'km' ? M_PER_MI : YD_PER_MI);
}

/** Stored feet -> feet or meters, rounded to 2 decimals for display. */
export function toDisplayElevation(ft: number | null, unit: DistanceUnit): number | null {
  if (ft === null) return null;
  return round2(unit === 'km' ? ft * M_PER_FT : ft);
}

/** Feet or meters as typed -> feet, at full precision. */
export function fromDisplayElevation(value: number | null, unit: DistanceUnit): number | null {
  if (value === null) return null;
  return unit === 'km' ? value / M_PER_FT : value;
}
