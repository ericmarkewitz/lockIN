import { LIFT_SUBCATEGORIES, MINDBODY_SUBCATEGORIES } from './exercises';
import type { FieldId } from './fields';
import type { CategoryKind } from './types';

export type LiftSubcategory = (typeof LIFT_SUBCATEGORIES)[number];
export type MindBodySubcategory = (typeof MINDBODY_SUBCATEGORIES)[number];
export type CatalogExercise = {
  name: string;
  /** The subcategory (a lift's muscle group, or a mind and body type) it is filed under; it labels the exercise everywhere it is shown. */
  subcategory?: LiftSubcategory | MindBodySubcategory;
  /** More muscle groups the lift works, so the picker lists it under those too. */
  also?: LiftSubcategory[];
  /** What it records, when not its category's default (`DEFAULT_FIELDS`). In standard order. */
  fields?: FieldId[];
};
export type CatalogCategory = { name: string; kind: CategoryKind; exercises: CatalogExercise[] };

/** A lift, written `'Squat'`, `['Deadlift', 'Legs']` for one that also works other groups, or in full to set its fields. */
type LiftEntry = string | [string, ...LiftSubcategory[]] | Omit<CatalogExercise, 'subcategory'>;
/** Lifts in one muscle group. Write `['Deadlift', 'Legs']` for a lift that also works other groups. */
const lifts = (subcategory: LiftSubcategory, ...entries: LiftEntry[]): CatalogExercise[] =>
  entries.map((n) => (typeof n === 'string' ? { name: n, subcategory }
    : Array.isArray(n) ? { name: n[0], subcategory, also: n.slice(1) as LiftSubcategory[] }
    : { ...n, subcategory }));
/** Exercises with no subcategory: a name, or `{ name, fields }` for one that records something else. */
const plain = (...entries: (string | CatalogExercise)[]): CatalogExercise[] =>
  entries.map((n) => (typeof n === 'string' ? { name: n } : n));

/** Bodyweight lifts log reps, with any weight added (a vest, a plate) as an extra. */
const bodyweight = (name: string, ...also: LiftSubcategory[]): Omit<CatalogExercise, 'subcategory'> =>
  ({ name, ...(also.length && { also }), fields: ['reps', 'addedWeight'] });
/** Cardio that climbs: time, distance and elevation gain. */
const uphill = (name: string): CatalogExercise => ({ name, fields: ['duration', 'distance', 'elevation'] });

/** Yoga, pilates, mobility or mindfulness exercises. */
const mindBody = (subcategory: MindBodySubcategory, ...names: string[]): CatalogExercise[] =>
  names.map((name) => ({ name, subcategory }));

/**
 * Every built-in category and exercise. `syncCatalog` adds whatever is missing on each launch,
 * so adding an exercise is one line here plus its figure in `MOTIONS`
 * (`src/components/motion/motions.ts`); a test fails until the figure exists.
 *
 * `fields` (what an exercise records) is synced too, so a built-in's can be changed here. Logged
 * values stay in the database either way; a field taken away just stops being shown.
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
        bodyweight('Push-up', 'Arms'), bodyweight('Dip', 'Arms'), 'Chest Press'),
      ...lifts('Back', ['Deadlift', 'Legs'], 'Bent-Over Row', bodyweight('Pull-up', 'Arms'), 'Lat Pulldown',
        'Seated Cable Row', 'Chest-Supported Row', ['Lat Pullover', 'Chest'], 'Kelso Shrug'),
      ...lifts('Shoulders', 'Overhead Press', 'Lateral Raise', 'Arnold Press', ['Rear Delt Fly', 'Back'],
        ['Face Pull', 'Back'], 'Seated Shoulder Press'),
      ...lifts('Arms', 'Bicep Curl', 'Tricep Pushdown', 'Tricep Extension', 'Skull Crusher',
        'Preacher Curl', 'Cable Curl', 'Incline Curl', 'Hammer Curl'),
      ...lifts('Legs', 'Squat', 'Front Squat', ['Romanian Deadlift', 'Back'], 'Leg Press', 'Lunge',
        'Goblet Squat', 'Bulgarian Split Squat', 'Single-Leg Romanian Deadlift', 'Step-up',
        'Hip Thrust', 'Glute Bridge', 'Hamstring Curl', 'Leg Extension',
        'Standing Calf Raise', 'Seated Calf Raise', 'Tibialis Raise', 'Hack Squat'),
      ...lifts('Core', { name: 'Weighted Plank', fields: ['weight', 'duration'] },
        { name: 'Farmer Carry', also: ['Arms'], fields: ['weight', 'shortDistance'] }, 'Russian Twist',
        bodyweight('Crunch'), 'Cable Crunch', bodyweight('Straight-Leg Sit-up'), bodyweight('Ab Wheel Rollout'),
        bodyweight('Bird Dog'), bodyweight('Dead Bug'), 'Pallof Press'),
    ],
  },
  {
    name: 'Cardio',
    kind: 'cardio',
    exercises: plain(
      'Running', uphill('Biking'), uphill('Hiking'),
      { name: 'Downhill Skiing', fields: ['duration', 'elevation', 'runs'] },
      { name: 'Swimming', fields: ['duration', 'shortDistance'] },
      { name: 'Rowing', fields: ['duration', 'shortDistance'] },
      { name: 'Walking', fields: ['duration', 'distance', 'steps'] },
      uphill('Ski Touring'), 'Cross-Country Skiing', uphill('Snowshoeing'),
      { name: 'Climbing', fields: ['duration', 'routes', 'difficulty'] },
      { name: 'Stair Stepper', fields: ['duration', 'floors'] },
      'Elliptical',
      { name: 'HIIT', fields: ['duration', 'rounds'] },
      { name: 'Golf', fields: ['duration', 'holes', 'score'] },
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
