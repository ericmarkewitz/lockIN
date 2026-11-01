import type { Db } from './types';

const SCHEMA_V1 = `
CREATE TABLE categories (
  id INTEGER PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('strength','cardio','mindbody'))
);
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  name TEXT NOT NULL,
  is_custom INTEGER NOT NULL DEFAULT 0,
  UNIQUE (category_id, name)
);
CREATE TABLE plan_days (
  weekday INTEGER PRIMARY KEY NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  is_rest INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE plan_items (
  id INTEGER PRIMARY KEY NOT NULL,
  weekday INTEGER NOT NULL REFERENCES plan_days(weekday) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER,
  target_reps INTEGER,
  target_duration_min REAL,
  target_distance REAL
);
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY NOT NULL,
  date TEXT NOT NULL UNIQUE,
  is_rest INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);
CREATE TABLE workout_exercises (
  id INTEGER PRIMARY KEY NOT NULL,
  workout_id INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  exercise_id INTEGER NOT NULL REFERENCES exercises(id),
  position INTEGER NOT NULL,
  target_sets INTEGER,
  target_reps INTEGER,
  target_duration_min REAL,
  target_distance REAL
);
CREATE TABLE sets (
  id INTEGER PRIMARY KEY NOT NULL,
  workout_exercise_id INTEGER NOT NULL REFERENCES workout_exercises(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  target_reps INTEGER,
  reps INTEGER,
  weight REAL,
  duration_min REAL,
  distance REAL,
  completed INTEGER NOT NULL DEFAULT 0,
  UNIQUE (workout_exercise_id, set_number)
);
CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
CREATE INDEX idx_workout_exercises_workout ON workout_exercises(workout_id);
CREATE INDEX idx_sets_we ON sets(workout_exercise_id);
INSERT INTO plan_days (weekday, is_rest) VALUES (0,0),(1,0),(2,0),(3,0),(4,0),(5,0),(6,0);
INSERT INTO settings (key, value) VALUES ('weight_unit', 'lb'), ('plan_complete', '0');
`;

export const SEED: { name: string; kind: 'strength' | 'cardio' | 'mindbody'; exercises: string[] }[] = [
  {
    name: 'Lifts',
    kind: 'strength',
    exercises: [
      'Bench Press', 'Incline Bench Press', 'Squat', 'Front Squat', 'Deadlift', 'Romanian Deadlift',
      'Overhead Press', 'Barbell Row', 'Pull-up', 'Lat Pulldown', 'Dumbbell Curl', 'Tricep Pushdown',
      'Leg Press', 'Lunge', 'Lateral Raise',
    ],
  },
  { name: 'Cardio', kind: 'cardio', exercises: ['Running', 'Biking', 'Hiking', 'Skiing', 'Swimming', 'Rowing', 'Walking'] },
  { name: 'Yoga', kind: 'mindbody', exercises: ['Vinyasa', 'Hatha', 'Yin', 'Power Yoga'] },
  { name: 'Mobility', kind: 'mindbody', exercises: ['Stretching', 'Foam Rolling'] },
];

async function seed(db: Db) {
  for (const cat of SEED) {
    const { lastInsertRowId } = await db.runAsync('INSERT INTO categories (name, kind) VALUES (?, ?)', [cat.name, cat.kind]);
    for (const ex of cat.exercises) {
      await db.runAsync('INSERT INTO exercises (category_id, name) VALUES (?, ?)', [lastInsertRowId, ex]);
    }
  }
}

/** Ordered migrations; index i upgrades user_version i -> i+1. Never edit a shipped one: append. */
const MIGRATIONS: ((db: Db) => Promise<void>)[] = [
  async (db) => {
    await db.execAsync(SCHEMA_V1);
    await seed(db);
  },
];

export const LATEST_VERSION = MIGRATIONS.length;

const inFlight = new WeakMap<Db, Promise<void>>();

/**
 * Brings the database to LATEST_VERSION. Calls on the same connection are serialized because
 * SQLiteProvider's onInit can fire more than once (Suspense retries, fast refresh).
 */
export function migrate(db: Db): Promise<void> {
  const run = (inFlight.get(db) ?? Promise.resolve()).then(() => migrateOnce(db));
  const settled = run.catch(() => {});
  inFlight.set(db, settled);
  return run;
}

async function readVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  return row?.user_version ?? 0;
}

async function migrateOnce(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  let version = await readVersion(db);

  // Recovery: schema exists but the version was never recorded (interrupted earlier run).
  if (version === 0) {
    const existing = await db.getFirstAsync("SELECT name FROM sqlite_master WHERE type='table' AND name='categories'");
    if (existing) {
      await db.execAsync('PRAGMA user_version = 1');
      version = 1;
    }
  }

  while (version < LATEST_VERSION) {
    const next = version + 1;
    await db.withTransactionAsync(async () => {
      await MIGRATIONS[version](db);
      await db.execAsync(`PRAGMA user_version = ${next}`);
    });
    version = next;
  }
}
