import type { FieldId } from './fields';
import type { DistanceUnit, WeightUnit } from './settings';

export type CategoryKind = 'strength' | 'cardio' | 'mindbody';

export type Exercise = {
  id: number;
  categoryId: number;
  name: string;
  isCustom: boolean;
  categoryName: string;
  categoryKind: CategoryKind;
  subcategory: string | null;
  /** More subcategories the exercise is listed under, besides its own. */
  alsoIn: string[];
  /** What it records, in the order shown. */
  fields: FieldId[];
  /**
   * Whether adding it to the plan asks what to record: for custom exercises and built-ins without
   * an obvious default, until the user sets one.
   */
  asksWhatToRecord: boolean;
};

export type Category = {
  id: number;
  name: string;
  kind: CategoryKind;
  /** Display order of the subcategories this category offers; empty if it has none. */
  subcategories: readonly string[];
  exercises: Exercise[];
};

export type Targets = {
  targetSets?: number | null;
  targetReps?: number | null;
  targetDurationMin?: number | null;
  targetDistance?: number | null;
  /** Steps, runs, routes or the like: whichever count the exercise records. */
  targetCount?: number | null;
};

export type PlanItemInput = Targets & {
  exerciseId: number;
  /** What this item records; left out or null, the exercise's default. */
  fields?: readonly FieldId[] | null;
};

export type PlanItem = Omit<PlanItemInput, 'fields'> & {
  id: number;
  position: number;
  exerciseName: string;
  isCustom: boolean;
  categoryName: string;
  categoryKind: CategoryKind;
  /** What it records: its own pick, else the exercise's default. */
  fields: FieldId[];
  /** What was picked for this item; null follows the exercise's default. */
  ownFields: FieldId[] | null;
};

export type PlanDay = { weekday: number; isRest: boolean; items: PlanItem[] };

export type WorkoutSet = {
  id: number;
  setNumber: number;
  targetReps: number | null;
  reps: number | null;
  weight: number | null;
  durationMin: number | null;
  /** Miles, also for a short distance shown in yards or meters. */
  distance: number | null;
  /** Steps, runs, routes or the like, as the exercise's fields say. */
  count: number | null;
  /** Elevation gain, in feet. */
  elevation: number | null;
  score: number | null;
  /** How hard it felt, 1–10. */
  difficulty: number | null;
  /** The unit this set was entered in; null follows the user's setting. For short distances and elevation, mi means yd and ft, km means m. */
  weightUnit: WeightUnit | null;
  distanceUnit: DistanceUnit | null;
  completed: boolean;
  /** Ticked off or holding any value, per the shared LOGGED_SET rule. */
  isLogged: boolean;
};

export type WorkoutExercise = {
  id: number;
  exerciseId: number;
  exerciseName: string;
  categoryName: string;
  categoryKind: CategoryKind;
  subcategory: string | null;
  position: number;
  targetSets: number | null;
  targetReps: number | null;
  targetDurationMin: number | null;
  targetDistance: number | null;
  targetCount: number | null;
  /** What it records on this day, in the order shown. */
  fields: FieldId[];
  /** What the exercise records by default, to tell whether this day's differs. */
  defaultFields: FieldId[];
  hasLoggedSets: boolean;
  /** Added by the user rather than seeded with the app. */
  isCustom: boolean;
  sets: WorkoutSet[];
};

export type Workout = {
  id: number;
  date: string;
  isRest: boolean;
  notes: string | null;
  exercises: WorkoutExercise[];
};

export type DayStatus = 'none' | 'rest' | 'planned' | 'partial' | 'completed' | 'missed';

export type DaySummary = {
  date: string;
  status: DayStatus;
  exerciseCount: number;
  kinds: CategoryKind[];
  /** A past day from before the first plan was saved. */
  beforePlan?: true;
};
