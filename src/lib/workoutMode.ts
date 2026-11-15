import type { DistanceUnit, Units, WeightUnit } from '@/data/settings';
import type { CategoryKind, WorkoutExercise, WorkoutSet } from '@/data/types';
import { formatDuration } from './duration';
import { formatDistance, toDisplayWeight } from './units';

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
  /** Stored units: pounds and miles. */
  weight: number | null;
  reps: number | null;
  weightUnit: WeightUnit;
  durationMin: number | null;
  distance: number | null;
  distanceUnit: DistanceUnit;
};

type Last = { sets: WorkoutSet[] } | null;

/**
 * What to show for a set before it's logged, so a set done as planned is one tap: what's
 * already logged, else the weight from the set before it today, else the same set last time.
 */
export function suggestEntry(exercise: WorkoutExercise, setIndex: number, last: Last, units: Units): Entry {
  const set = exercise.sets[setIndex];
  const earlier = exercise.sets.slice(0, setIndex).reverse().find((s) => s.weight !== null);
  const previous = last?.sets[setIndex] ?? last?.sets.at(-1);
  const source = set.weight !== null ? set : earlier ?? previous;
  return {
    weight: source?.weight ?? null,
    reps: set.reps ?? set.targetReps ?? last?.sets[setIndex]?.reps ?? null,
    weightUnit: set.weightUnit ?? source?.weightUnit ?? units.weight,
    durationMin: set.durationMin ?? exercise.targetDurationMin,
    distance: set.distance ?? exercise.targetDistance,
    distanceUnit: set.distanceUnit ?? units.distance,
  };
}

/** "135×10, 135×8", or "30 min 3.1 mi". Always in the user's units, even for sets entered in the other one. */
export const formatSets = (sets: WorkoutSet[], kind: CategoryKind, units: Units) =>
  sets
    .map((s) => (kind === 'strength'
      ? `${toDisplayWeight(s.weight, units.weight) ?? '–'}×${s.reps ?? '–'}`
      : `${formatDuration(s.durationMin) || '–'}${s.distance ? ` ${formatDistance(s.distance, units.distance)}` : ''}`))
    .join(', ');
