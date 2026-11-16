import { syncCatalog } from './catalog';
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

type SeedCategory = { name: string; kind: 'strength' | 'cardio' | 'mindbody'; exercises: string[] };

/**
 * The catalog migration 1 seeded. Frozen: the current one is `CATALOG` (`src/data/catalog.ts`),
 * which `syncCatalog` brings every install up to after the migrations run.
 */
export const SEED_V1: SeedCategory[] = [
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
  for (const cat of SEED_V1) {
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
  // Marks workouts the user changed by hand, so plan edits don't regenerate them.
  async (db) => {
    await db.execAsync('ALTER TABLE workouts ADD COLUMN is_customized INTEGER NOT NULL DEFAULT 0');
  },
  // Groups lifts by muscle. Backfills the seeded lifts; custom ones stay uncategorized.
  async (db) => {
    await db.execAsync('ALTER TABLE exercises ADD COLUMN subcategory TEXT');
    const lifts: Record<string, string[]> = {
      Chest: ['Bench Press', 'Incline Bench Press'],
      Back: ['Deadlift', 'Barbell Row', 'Pull-up', 'Lat Pulldown'],
      Shoulders: ['Overhead Press', 'Lateral Raise'],
      Arms: ['Dumbbell Curl', 'Tricep Pushdown'],
      Legs: ['Squat', 'Front Squat', 'Romanian Deadlift', 'Leg Press', 'Lunge'],
    };
    for (const [subcategory, names] of Object.entries(lifts)) {
      await db.runAsync(
        `UPDATE exercises SET subcategory = ?
         WHERE is_custom = 0 AND category_id = (SELECT id FROM categories WHERE name = 'Lifts')
           AND name IN (${names.map(() => '?').join(',')})`,
        [subcategory, ...names],
      );
    }
  },
  // Splits Skiing into three kinds and adds snowshoeing and climbing. Renaming keeps logged
  // skiing on the same row. A name the user already has as a custom exercise is left to them.
  async (db) => {
    const cardio = "(SELECT id FROM categories WHERE name = 'Cardio')";
    await db.runAsync(
      `UPDATE exercises SET name = 'Downhill Skiing'
       WHERE is_custom = 0 AND name = 'Skiing' AND category_id = ${cardio}
         AND NOT EXISTS (SELECT 1 FROM exercises WHERE name = 'Downhill Skiing' AND category_id = ${cardio})`,
    );
    for (const name of ['Ski Touring', 'Cross-Country Skiing', 'Snowshoeing', 'Climbing']) {
      await db.runAsync(`INSERT OR IGNORE INTO exercises (category_id, name) VALUES (${cardio}, ?)`, [name]);
    }
  },
  // Records the unit a set was entered in (weight is still stored in lb, distance in mi), so a
  // set logged in kg reopens in kg. NULL means "the user's setting". Distances logged before this
  // had no unit at all; they are kept as they are and read as miles.
  async (db) => {
    await db.execAsync(`
      ALTER TABLE sets ADD COLUMN weight_unit TEXT CHECK (weight_unit IN ('lb','kg'));
      ALTER TABLE sets ADD COLUMN distance_unit TEXT CHECK (distance_unit IN ('mi','km'));
    `);
  },
  // A snapshot of the weekly plan each time it is saved, so past days keep the plan they had.
  // `kinds` lists the day's category kinds in plan order, comma separated. Existing installs get
  // one snapshot of the current plan, from when the plan was first saved or the first workout.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE plan_history (
        effective_from TEXT NOT NULL,
        weekday INTEGER NOT NULL CHECK (weekday BETWEEN 0 AND 6),
        is_rest INTEGER NOT NULL,
        exercise_count INTEGER NOT NULL,
        kinds TEXT NOT NULL,
        PRIMARY KEY (effective_from, weekday)
      );
    `);
    const start = await db.getFirstAsync<{ d: string | null }>(
      `SELECT MIN(d) AS d FROM (
         SELECT value AS d FROM settings WHERE key = 'plan_started'
         UNION ALL SELECT MIN(date) FROM workouts
       )`,
    );
    if (!start?.d) return;
    const days = await db.getAllAsync<{ weekday: number; is_rest: number }>('SELECT weekday, is_rest FROM plan_days');
    const items = await db.getAllAsync<{ weekday: number; kind: string }>(
      `SELECT p.weekday, c.kind FROM plan_items p
       JOIN exercises e ON e.id = p.exercise_id JOIN categories c ON c.id = e.category_id
       ORDER BY p.weekday, p.position`,
    );
    for (const d of days) {
      const kinds = items.filter((i) => i.weekday === d.weekday).map((i) => i.kind);
      await db.runAsync(
        'INSERT INTO plan_history (effective_from, weekday, is_rest, exercise_count, kinds) VALUES (?, ?, ?, ?, ?)',
        [start.d, d.weekday, d.is_rest, kinds.length, [...new Set(kinds)].join(',')],
      );
    }
  },  // Extra muscle groups an exercise works besides its own `subcategory`, so a deadlift is listed
  // under Legs as well as Back. syncCatalog fills in the built-ins' groups after migrating.
  async (db) => {
    await db.execAsync(`
      CREATE TABLE exercise_subcategories (
        exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
        subcategory TEXT NOT NULL,
        PRIMARY KEY (exercise_id, subcategory)
      );
    `);
  },  // A removed custom exercise that was already logged is hidden instead of deleted, so the
  // workouts it was logged in keep it. Hidden exercises are left out of the exercise list.
  async (db) => {
    await db.execAsync('ALTER TABLE exercises ADD COLUMN is_hidden INTEGER NOT NULL DEFAULT 0');
  },
  // Puts Yoga and Mobility in one category, 'Yoga & Mobility', with each as a subcategory. The
  // Yoga row is renamed so it keeps its place; Mobility's exercises move into it and keep their
  // ids, so logged workouts and the plan still point at them. An exercise both had (any case) is
  // merged into the Yoga one, which is then also listed under Mobility.
  async (db) => {
    const id = async (name: string) =>
      (await db.getFirstAsync<{ id: number }>('SELECT id FROM categories WHERE name = ?', [name]))?.id;
    const yoga = await id('Yoga');
    const mobility = await id('Mobility');
    if (yoga === undefined || mobility === undefined) return;
    await db.runAsync("UPDATE categories SET name = 'Yoga & Mobility' WHERE id = ?", [yoga]);
    await db.runAsync("UPDATE exercises SET subcategory = 'Yoga' WHERE category_id = ?", [yoga]);
    const moving = await db.getAllAsync<{ id: number; name: string; is_hidden: number }>(
      'SELECT id, name, is_hidden FROM exercises WHERE category_id = ?',
      [mobility],
    );
    for (const ex of moving) {
      const twin = await db.getFirstAsync<{ id: number }>(
        'SELECT id FROM exercises WHERE category_id = ? AND name = ? COLLATE NOCASE',
        [yoga, ex.name],
      );
      if (!twin) {
        await db.runAsync("UPDATE exercises SET category_id = ?, subcategory = 'Mobility' WHERE id = ?", [yoga, ex.id]);
        continue;
      }
      await db.runAsync('UPDATE workout_exercises SET exercise_id = ? WHERE exercise_id = ?', [twin.id, ex.id]);
      await db.runAsync('UPDATE plan_items SET exercise_id = ? WHERE exercise_id = ?', [twin.id, ex.id]);
      await db.runAsync("INSERT OR IGNORE INTO exercise_subcategories (exercise_id, subcategory) VALUES (?, 'Mobility')", [twin.id]);
      if (!ex.is_hidden) await db.runAsync('UPDATE exercises SET is_hidden = 0 WHERE id = ?', [twin.id]);
      await db.runAsync('DELETE FROM exercises WHERE id = ?', [ex.id]);
    }
    await db.runAsync('DELETE FROM categories WHERE id = ?', [mobility]);
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

  await syncCatalog(db);
}
