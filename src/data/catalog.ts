import { LIFT_SUBCATEGORIES, MINDBODY_SUBCATEGORIES } from './exercises';
import type { CategoryKind } from './types';

export type LiftSubcategory = (typeof LIFT_SUBCATEGORIES)[number];
export type MindBodySubcategory = (typeof MINDBODY_SUBCATEGORIES)[number];
export type CatalogExercise = {
  name: string;
  /** The subcategory (a lift's muscle group, or a mind and body type) it is filed under; it labels the exercise everywhere it is shown. */
  subcategory?: LiftSubcategory | MindBodySubcategory;
  /** More muscle groups the lift works, so the picker lists it under those too. */
  also?: LiftSubcategory[];
};
export type CatalogCategory = { name: string; kind: CategoryKind; exercises: CatalogExercise[] };

const plain = (...names: string[]): CatalogExercise[] => names.map((name) => ({ name }));
/** Lifts in one muscle group. Write `['Deadlift', 'Legs']` for a lift that also works other groups. */
const lifts = (subcategory: LiftSubcategory, ...names: (string | [string, ...LiftSubcategory[]])[]): CatalogExercise[] =>
  names.map((n) => (typeof n === 'string' ? { name: n, subcategory } : { name: n[0], subcategory, also: n.slice(1) as LiftSubcategory[] }));
/** Yoga, pilates, mobility or mindfulness exercises. */
const mindBody = (subcategory: MindBodySubcategory, ...names: string[]): CatalogExercise[] =>
  names.map((name) => ({ name, subcategory }));

/**
 * Every built-in category and exercise. `syncCatalog` adds whatever is missing on each launch,
 * so adding an exercise is one line here plus its figure in `MOTIONS`
 * (`src/components/motion/motions.ts`); a test fails until the figure exists.
 *
 * Muscle groups in `also` are synced the same way, so a new one can be added here too.
 *
 * Only add here. Renaming, moving or removing a built-in changes rows people have logged
 * against, so it needs a migration (`src/db/migrations.ts`), and this list updated to match.
 */
export const CATALOG: CatalogCategory[] = [
  {
    name: 'Lifts',
    kind: 'strength',
    exercises: [
      ...lifts('Chest', 'Bench Press', 'Incline Bench Press', ['Close-Grip Bench Press', 'Arms'], 'Pec Fly',
        ['Push-up', 'Arms'], ['Dip', 'Arms'], 'Chest Press'),
      ...lifts('Back', ['Deadlift', 'Legs'], 'Bent-Over Row', ['Pull-up', 'Arms'], 'Lat Pulldown',
        'Seated Cable Row', 'Chest-Supported Row', ['Lat Pullover', 'Chest'], 'Kelso Shrug'),
      ...lifts('Shoulders', 'Overhead Press', 'Lateral Raise', 'Arnold Press', ['Rear Delt Fly', 'Back'],
        ['Face Pull', 'Back'], 'Seated Shoulder Press'),
      ...lifts('Arms', 'Bicep Curl', 'Tricep Pushdown', 'Tricep Extension', 'Skull Crusher',
        'Preacher Curl', 'Cable Curl', 'Incline Curl', 'Hammer Curl'),
      ...lifts('Legs', 'Squat', 'Front Squat', ['Romanian Deadlift', 'Back'], 'Leg Press', 'Lunge',
        'Goblet Squat', 'Bulgarian Split Squat', 'Single-Leg Romanian Deadlift', 'Step-up',
        'Hip Thrust', 'Glute Bridge', 'Hamstring Curl', 'Leg Extension',
        'Standing Calf Raise', 'Seated Calf Raise', 'Tibialis Raise', 'Hack Squat'),
      ...lifts('Core', 'Weighted Plank', ['Farmer Carry', 'Arms'], 'Russian Twist', 'Crunch', 'Cable Crunch',
        'Straight-Leg Sit-up', 'Ab Wheel Rollout', 'Bird Dog', 'Dead Bug', 'Pallof Press'),
    ],
  },
  {
    name: 'Cardio',
    kind: 'cardio',
    exercises: plain(
      'Running', 'Biking', 'Hiking', 'Downhill Skiing', 'Swimming', 'Rowing', 'Walking',
      'Ski Touring', 'Cross-Country Skiing', 'Snowshoeing', 'Climbing', 'Stair Stepper', 'Elliptical',
      'HIIT', 'Golf',
    ),
  },
  {
    name: 'Mind & Body',
    kind: 'mindbody',
    exercises: [
      ...mindBody('Yoga', 'Vinyasa', 'Hatha', 'Yin', 'Power Yoga'),
      ...mindBody('Pilates', 'Mat Pilates', 'Reformer Pilates'),
      ...mindBody('Mobility', 'Stretching', 'Foam Rolling'),
      ...mindBody('Mindfulness', 'Meditation'),
    ],
  },
];
