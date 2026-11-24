import { FIELDS, fieldFor, type FieldId, type SetValueKey } from '@/data/fields';
import type { Units } from '@/data/settings';
import type { CategoryKind, Exercise, Targets, WorkoutSet } from '@/data/types';
import { formatDuration } from './duration';
import {
  elevationUnit, fromDisplayDistance, fromDisplayElevation, fromDisplayShortDistance, fromDisplayWeight, shortDistanceUnit,
  toDisplayDistance, toDisplayElevation, toDisplayShortDistance, toDisplayWeight,
} from './units';

/** The unit a field's number is shown with: "kg", "yd", "steps", "/10"; blank for time and score. */
export function fieldUnit(id: FieldId, units: Units): string {
  const f = FIELDS[id];
  switch (f.input) {
    case 'weight': return units.weight;
    case 'distance': return units.distance;
    case 'shortDistance': return shortDistanceUnit(units.distance);
    case 'elevation': return elevationUnit(units.distance);
    case 'difficulty': return '/10';
    default: return f.noun ?? '';
  }
}

/** A stored value in the units it is shown in. Counts, reps, time and difficulty are shown as stored. */
export function toDisplayField(id: FieldId, stored: number | null, units: Units): number | null {
  switch (FIELDS[id].input) {
    case 'weight': return toDisplayWeight(stored, units.weight);
    case 'distance': return toDisplayDistance(stored, units.distance);
    case 'shortDistance': return toDisplayShortDistance(stored, units.distance);
    case 'elevation': return toDisplayElevation(stored, units.distance);
    default: return stored;
  }
}

/** A value as typed, in the units shown, back to how it is stored. */
export function fromDisplayField(id: FieldId, value: number | null, units: Units): number | null {
  switch (FIELDS[id].input) {
    case 'weight': return fromDisplayWeight(value, units.weight);
    case 'distance': return fromDisplayDistance(value, units.distance);
    case 'shortDistance': return fromDisplayShortDistance(value, units.distance);
    case 'elevation': return fromDisplayElevation(value, units.distance);
    default: return value;
  }
}

/** A set's stored value for a field. */
export const fieldValue = (set: Pick<WorkoutSet, SetValueKey>, id: FieldId): number | null => set[FIELDS[id].key];

/** "12,000" or "1,609.34". By hand, because Hermes doesn't always group with toLocaleString. */
const grouped = (n: number) => {
  const [whole, decimals] = String(n).split('.');
  return `${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${decimals ? `.${decimals}` : ''}`;
};

/** A stored value written out with its unit: "135 lb", "+25 lb", "12,000 steps", "Difficulty 7/10". Blank for none. */
export function formatField(id: FieldId, stored: number | null, units: Units): string {
  if (stored === null) return '';
  const f = FIELDS[id];
  const n = toDisplayField(id, stored, units)!;
  if (f.input === 'duration') return formatDuration(n);
  if (f.input === 'difficulty') return `${f.label} ${n}/10`;
  if (id === 'score') return `${f.label} ${n}`;
  if (f.noun) return `${grouped(n)} ${n === 1 ? f.noun.replace(/s$/, '') : f.noun}`;
  return `${id === 'addedWeight' ? '+' : ''}${grouped(n)} ${fieldUnit(id, units)}`;
}

/**
 * What's planned, one part each: "3×10" (or "3 sets" for a lift without reps), then the time,
 * distance and count planned. Nothing for targets not set.
 */
export function formatTargets(
  e: Targets & { categoryKind: CategoryKind; fields: readonly FieldId[] },
  units: Units,
): string[] {
  const parts: string[] = [];
  if (e.categoryKind === 'strength' && e.targetSets) {
    parts.push(e.fields.includes('reps') ? `${e.targetSets}×${e.targetReps ?? '?'}` : `${e.targetSets} ${e.targetSets === 1 ? 'set' : 'sets'}`);
  }
  const planned = (key: SetValueKey, value: number | null | undefined) => {
    const f = fieldFor(e.fields, key);
    if (f && value) parts.push(formatField(f, value, units));
  };
  planned('durationMin', e.targetDurationMin);
  planned('distance', e.targetDistance);
  planned('count', e.targetCount);
  return parts;
}

/** What a newly added exercise is planned with: a lift gets 3 sets, of 10 reps if it has reps. */
export const defaultTargets = (e: Pick<Exercise, 'categoryKind' | 'fields'>): Targets =>
  (e.categoryKind === 'strength' ? { targetSets: 3, ...(e.fields.includes('reps') && { targetReps: 10 }) } : {});
