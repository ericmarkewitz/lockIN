import type { CategoryKind } from './types';

/**
 * What an exercise records. Each one is stored in a place (`key`, a column of `sets`); some share
 * one, like Steps and Routes (both counts), so an exercise records at
 * most one of each. This list is the standard order fields are shown in.
 */
export const FIELD_IDS = [
  'weight', 'reps', 'duration', 'distance', 'shortDistance', 'elevation',
  'steps', 'runs', 'routes', 'rounds', 'floors', 'holes', 'score', 'difficulty',
] as const;
export type FieldId = (typeof FIELD_IDS)[number];

/** Where a field's value lives on a set (and in `SetPatch`). */
export type SetValueKey = 'weight' | 'reps' | 'durationMin' | 'distance' | 'elevation' | 'count' | 'score' | 'difficulty';
/** The plan target a field can have. */
export type TargetKey = 'targetReps' | 'targetDurationMin' | 'targetDistance' | 'targetCount';
/**
 * How a value is entered and converted: weights are stored in lb, distances in miles (a short
 * distance is shown in yd or m) and elevation in feet. Counts are whole numbers; difficulty is 1–10.
 */
export type FieldInput = 'weight' | 'reps' | 'duration' | 'distance' | 'shortDistance' | 'elevation' | 'count' | 'difficulty';

export type FieldDef = {
  id: FieldId;
  label: string;
  key: SetValueKey;
  input: FieldInput;
  /** What a count is of, plural: "12,000 steps". */
  noun?: string;
  target?: TargetKey;
};

const count = (id: FieldId, label: string): FieldDef => ({ id, label, key: 'count', input: 'count', noun: label.toLowerCase(), target: 'targetCount' });

export const FIELDS: Record<FieldId, FieldDef> = {
  weight: { id: 'weight', label: 'Weight', key: 'weight', input: 'weight' },
  reps: { id: 'reps', label: 'Reps', key: 'reps', input: 'reps', noun: 'reps', target: 'targetReps' },
  duration: { id: 'duration', label: 'Time', key: 'durationMin', input: 'duration', target: 'targetDurationMin' },
  distance: { id: 'distance', label: 'Distance', key: 'distance', input: 'distance', target: 'targetDistance' },
  shortDistance: { id: 'shortDistance', label: 'Distance', key: 'distance', input: 'shortDistance', target: 'targetDistance' },
  elevation: { id: 'elevation', label: 'Elevation', key: 'elevation', input: 'elevation' },
  steps: count('steps', 'Steps'),
  runs: count('runs', 'Runs'),
  routes: count('routes', 'Routes'),
  rounds: count('rounds', 'Rounds'),
  floors: count('floors', 'Floors'),
  holes: count('holes', 'Holes'),
  score: { id: 'score', label: 'Score', key: 'score', input: 'count' },
  difficulty: { id: 'difficulty', label: 'Difficulty', key: 'difficulty', input: 'difficulty' },
};

/** What an exercise records when it doesn't say: lifts weight × reps, cardio time and distance, mind and body time. */
export const DEFAULT_FIELDS: Record<CategoryKind, readonly FieldId[]> = {
  strength: ['weight', 'reps'],
  cardio: ['duration', 'distance'],
  mindbody: ['duration'],
};

/** The fields each kind of category can record, offered when creating an exercise. Standard order. */
export const FIELD_CHOICES: Record<CategoryKind, readonly FieldId[]> = {
  strength: ['weight', 'reps', 'duration', 'shortDistance'],
  cardio: [
    'duration', 'distance', 'shortDistance', 'elevation', 'steps', 'runs', 'routes', 'rounds', 'floors', 'holes', 'score', 'difficulty',
  ],
  mindbody: ['duration', 'difficulty'],
};

const KIND_NAMES: Record<CategoryKind, string> = { strength: 'strength', cardio: 'cardio', mindbody: 'mind and body' };

const isFieldId = (s: string): s is FieldId => (FIELD_IDS as readonly string[]).includes(s);
const byStandardOrder = (a: FieldId, b: FieldId) => FIELD_IDS.indexOf(a) - FIELD_IDS.indexOf(b);

/**
 * Checks fields for an exercise of `kind`: in standard order, and only the first of any that share
 * a place. Throws for a field the kind doesn't offer, or none at all.
 */
export function normalizeFields(fields: readonly FieldId[], kind: CategoryKind): FieldId[] {
  const out: FieldId[] = [];
  for (const f of fields) {
    if (!FIELD_CHOICES[kind].includes(f)) throw new Error(`${FIELDS[f]?.label ?? f} is not available for ${KIND_NAMES[kind]} exercises`);
    if (!out.some((o) => FIELDS[o].key === FIELDS[f].key)) out.push(f);
  }
  if (!out.length) throw new Error('Pick at least one thing to record');
  return out.sort(byStandardOrder);
}

/** An exercise's stored fields, or its category's default when none (or none known) are stored. */
export function parseFields(stored: string | null, kind: CategoryKind): FieldId[] {
  const known = (stored ?? '').split(',').filter(isFieldId);
  return known.length ? known : [...DEFAULT_FIELDS[kind]];
}

export const serializeFields = (fields: readonly FieldId[]) => fields.join(',');

/** Turns `id` on or off. Turning one on replaces any that shares its place; the last one stays on. */
export function toggleField(fields: readonly FieldId[], id: FieldId, kind: CategoryKind): FieldId[] {
  if (fields.includes(id)) return fields.length > 1 ? fields.filter((f) => f !== id) : [...fields];
  return normalizeFields([id, ...fields.filter((f) => FIELDS[f].key !== FIELDS[id].key)], kind);
}

/** The field among `fields` stored in `key`, if any. */
export const fieldFor = (fields: readonly FieldId[], key: SetValueKey): FieldId | null =>
  fields.find((f) => FIELDS[f].key === key) ?? null;

/** The plan targets an exercise with these fields can have, in field order. */
export const targetKeys = (fields: readonly FieldId[]): TargetKey[] =>
  fields.flatMap((f) => (FIELDS[f].target ? [FIELDS[f].target] : []));
