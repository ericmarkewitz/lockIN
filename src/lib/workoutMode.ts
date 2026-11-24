import type { FieldId, SetValueKey } from '@/data/fields';
import type { DistanceUnit, Units, WeightUnit } from '@/data/settings';
import type { WorkoutExercise, WorkoutSet } from '@/data/types';
import { fieldValue, formatField } from './fields';
import { toDisplayWeight } from './units';

/**
 * Workout mode walks a day's sets in order, one at a time. Where you are is never stored:
 * it opens on the first set not done, so leaving and coming back resumes where you stopped.
 */
export type Step = { exercise: WorkoutExercise; exerciseIndex: number; set: WorkoutSet; setIndex: number };

/**
 * Every set of every exercise, in order. An exercise with no sets has no steps and isn't
 * counted, so `exerciseIndex` numbers only the exercises workout mode goes through.
 */
export function workoutSteps(exercises: WorkoutExercise[]): Step[] {
  return exercises.filter((e) => e.sets.length > 0).flatMap((exercise, exerciseIndex) =>
    exercise.sets.map((set, setIndex) => ({ exercise, exerciseIndex, set, setIndex })));
}

/** Index of the first set not done, or -1 when everything is. */
export const firstOpenStep = (steps: Step[]) => steps.findIndex((s) => !s.set.completed);

/** Index of the next set not done after `from`, or -1 at the end. Skipped sets are not revisited. */
export function nextOpenStep(steps: Step[], from: number): number {
  for (let i = from + 1; i < steps.length; i++) if (!steps[i].set.completed) return i;
  return -1;
}

export type Entry = {
  /** Stored units: pounds, miles and feet. */
  weight: number | null;
  reps: number | null;
  weightUnit: WeightUnit;
  durationMin: number | null;
  distance: number | null;
  distanceUnit: DistanceUnit;
  count: number | null;
  elevation: number | null;
  score: number | null;
  difficulty: number | null;
};

type Last = { sets: WorkoutSet[] } | null;

/**
 * What to show for a set before it's logged, so a set done as planned is one tap: what's
 * already logged, else the weight from the set before it today, else the same set last time.
 * A lift's time or distance (a hold, a carry) is the planned one, else carried the same way.
 * Elevation, a score and a difficulty are only ever what's logged.
 */
export function suggestEntry(exercise: WorkoutExercise, setIndex: number, last: Last, units: Units): Entry {
  const set = exercise.sets[setIndex];
  const before = exercise.sets.slice(0, setIndex).reverse();
  const earlier = before.find((s) => s.weight !== null);
  const previous = last?.sets[setIndex] ?? last?.sets.at(-1);
  const source = set.weight !== null ? set : earlier ?? previous;
  const lift = exercise.categoryKind === 'strength';
  /** For a lift: the set before today with a value, else last time's. */
  const carried = (key: 'durationMin' | 'distance') => (lift ? before.find((s) => s[key] !== null)?.[key] ?? previous?.[key] ?? null : null);
  return {
    weight: source?.weight ?? null,
    reps: set.reps ?? set.targetReps ?? last?.sets[setIndex]?.reps ?? null,
    weightUnit: set.weightUnit ?? source?.weightUnit ?? units.weight,
    durationMin: set.durationMin ?? exercise.targetDurationMin ?? carried('durationMin'),
    distance: set.distance ?? exercise.targetDistance ?? carried('distance'),
    distanceUnit: set.distanceUnit ?? units.distance,
    count: set.count ?? exercise.targetCount,
    elevation: set.elevation,
    score: set.score,
    difficulty: set.difficulty,
  };
}

/**
 * One set's values for the exercise's fields, "30 min 3.1 mi" or "45 lb × 1 min" (a weight goes
 * with what it was held or carried for). Blank when nothing is entered.
 */
export const formatEntry = (values: Pick<WorkoutSet, SetValueKey>, fields: readonly FieldId[], units: Units) =>
  fields.map((f) => formatField(f, fieldValue(values, f), units)).filter(Boolean).join(fields.includes('weight') ? ' × ' : ' ');

/**
 * "135×10, 135×8", "30 min 3.1 mi", "45 lb × 1 min" or "12 reps +25 lb": each set's values for
 * the exercise's fields. Always in the user's units, even for sets entered in the other one.
 */
export function formatSets(sets: WorkoutSet[], fields: readonly FieldId[], units: Units): string {
  const compact = fields.includes('weight') && fields.includes('reps');
  return sets
    .map((s) => (compact ? `${toDisplayWeight(s.weight, units.weight) ?? '–'}×${s.reps ?? '–'}` : formatEntry(s, fields, units) || '–'))
    .join(', ');
}

/** Total weight × reps over finished strength sets, in `unit`. */
export function workoutVolume(steps: Step[], unit: WeightUnit): number {
  return steps.reduce((sum, { exercise, set }) => {
    if (exercise.categoryKind !== 'strength' || !set.completed || !set.weight || !set.reps) return sum;
    return sum + (toDisplayWeight(set.weight, unit) ?? 0) * set.reps;
  }, 0);
}

/** "12,450". Done by hand because Hermes doesn't always group with toLocaleString. */
export const groupThousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
