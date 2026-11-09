import { LIFT_SUBCATEGORIES } from './exercises';
import type { CategoryKind } from './types';

export type LiftSubcategory = (typeof LIFT_SUBCATEGORIES)[number];
export type CatalogExercise = { name: string; subcategory?: LiftSubcategory };
export type CatalogCategory = { name: string; kind: CategoryKind; exercises: CatalogExercise[] };

const plain = (...names: string[]): CatalogExercise[] => names.map((name) => ({ name }));
const lifts = (subcategory: LiftSubcategory, ...names: string[]): CatalogExercise[] =>
  names.map((name) => ({ name, subcategory }));

/**
 * Every built-in category and exercise. `syncCatalog` adds whatever is missing on each launch,
 * so adding an exercise is one line here plus its figure in `MOTIONS`
 * (`src/components/motion/motions.ts`); a test fails until the figure exists.
 *
 * Only add here. Renaming, moving or removing a built-in changes rows people have logged
 * against, so it needs a migration (`src/db/migrations.ts`), and this list updated to match.
 */
export const CATALOG: CatalogCategory[] = [
  {
    name: 'Lifts',
    kind: 'strength',
    exercises: [
      ...lifts('Chest', 'Bench Press', 'Incline Bench Press'),
      ...lifts('Back', 'Deadlift', 'Barbell Row', 'Pull-up', 'Lat Pulldown'),
      ...lifts('Shoulders', 'Overhead Press', 'Lateral Raise'),
      ...lifts('Arms', 'Dumbbell Curl', 'Tricep Pushdown'),
      ...lifts('Legs', 'Squat', 'Front Squat', 'Romanian Deadlift', 'Leg Press', 'Lunge'),
    ],
  },
  {
    name: 'Cardio',
    kind: 'cardio',
    exercises: plain(
      'Running', 'Biking', 'Hiking', 'Downhill Skiing', 'Swimming', 'Rowing', 'Walking',
      'Ski Touring', 'Cross-Country Skiing', 'Snowshoeing', 'Climbing',
    ),
  },
  { name: 'Yoga', kind: 'mindbody', exercises: plain('Vinyasa', 'Hatha', 'Yin', 'Power Yoga') },
  { name: 'Mobility', kind: 'mindbody', exercises: plain('Stretching', 'Foam Rolling') },
];
