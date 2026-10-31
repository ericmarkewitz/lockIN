import * as SQLite from 'expo-sqlite';

export type Exercise = { id: number; name: string; muscle: string };

export type PlanItem = {
  id: number;
  day: number; // 0 = Monday ... 6 = Sunday
  exerciseId: number;
  name: string;
  muscle: string;
  sets: number;
  reps: number;
  weight: number; // lb
};

// Add more lifts here any time; new ones are inserted on next launch.
const SEED_EXERCISES: Pick<Exercise, 'name' | 'muscle'>[] = [
  { name: 'Bench Press', muscle: 'Chest' },
  { name: 'Incline Dumbbell Press', muscle: 'Chest' },
  { name: 'Bicep Curl', muscle: 'Biceps' },
  { name: 'Tricep Pushdown', muscle: 'Triceps' },
  { name: 'Overhead Press', muscle: 'Shoulders' },
  { name: 'Barbell Row', muscle: 'Back' },
  { name: 'Lat Pulldown', muscle: 'Back' },
  { name: 'Squat', muscle: 'Legs' },
  { name: 'Deadlift', muscle: 'Legs' },
  { name: 'Leg Press', muscle: 'Legs' },
];

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function init() {
  const db = await SQLite.openDatabaseAsync('lockin.db');
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS exercises (
      id     INTEGER PRIMARY KEY AUTOINCREMENT,
      name   TEXT NOT NULL UNIQUE,
      muscle TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS plan_items (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      day         INTEGER NOT NULL CHECK (day BETWEEN 0 AND 6),
      exercise_id INTEGER NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      sets        INTEGER NOT NULL DEFAULT 3,
      reps        INTEGER NOT NULL DEFAULT 10,
      weight      REAL    NOT NULL DEFAULT 0,
      position    INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_plan_day ON plan_items(day, position);

    -- What you actually did: one row per set, keyed by calendar date (YYYY-MM-DD).
    CREATE TABLE IF NOT EXISTS set_logs (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      date           TEXT    NOT NULL,
      exercise_id    INTEGER NOT NULL REFERENCES exercises(id),
      exercise_order INTEGER NOT NULL DEFAULT 0,
      set_number     INTEGER NOT NULL,
      reps           INTEGER NOT NULL,
      weight         REAL    NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_logs_date ON set_logs(date, exercise_order, set_number);
  `);

  for (const e of SEED_EXERCISES) {
    await db.runAsync(
      'INSERT OR IGNORE INTO exercises (name, muscle) VALUES (?, ?)',
      e.name,
      e.muscle
    );
  }
  return db;
}

function getDb() {
  if (!dbPromise) dbPromise = init();
  return dbPromise;
}

export async function getExercises(): Promise<Exercise[]> {
  const db = await getDb();
  return db.getAllAsync<Exercise>(
    'SELECT id, name, muscle FROM exercises ORDER BY muscle, name'
  );
}

export async function getPlanForDay(day: number): Promise<PlanItem[]> {
  const db = await getDb();
  return db.getAllAsync<PlanItem>(
    `SELECT p.id, p.day, p.exercise_id AS exerciseId, e.name, e.muscle,
            p.sets, p.reps, p.weight
       FROM plan_items p
       JOIN exercises e ON e.id = p.exercise_id
      WHERE p.day = ?
      ORDER BY p.position, p.id`,
    day
  );
}

/** Number of planned lifts per day, indexed 0..6 */
export async function getDayCounts(): Promise<number[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ day: number; n: number }>(
    'SELECT day, COUNT(*) AS n FROM plan_items GROUP BY day'
  );
  const counts = [0, 0, 0, 0, 0, 0, 0];
  rows.forEach((r) => (counts[r.day] = r.n));
  return counts;
}

export async function addToPlan(day: number, exerciseId: number) {
  const db = await getDb();
  // Start from the last numbers used for this lift so you don't retype them.
  const last = await db.getFirstAsync<{ sets: number; reps: number; weight: number }>(
    'SELECT sets, reps, weight FROM plan_items WHERE exercise_id = ? ORDER BY id DESC LIMIT 1',
    exerciseId
  );
  const pos = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM plan_items WHERE day = ?',
    day
  );
  await db.runAsync(
    'INSERT INTO plan_items (day, exercise_id, sets, reps, weight, position) VALUES (?, ?, ?, ?, ?, ?)',
    day,
    exerciseId,
    last?.sets ?? 3,
    last?.reps ?? 10,
    last?.weight ?? 0,
    pos?.next ?? 0
  );
}

export async function updatePlanItem(
  id: number,
  values: { sets: number; reps: number; weight: number }
) {
  const db = await getDb();
  await db.runAsync(
    'UPDATE plan_items SET sets = ?, reps = ?, weight = ? WHERE id = ?',
    values.sets,
    values.reps,
    values.weight,
    id
  );
}

export async function removePlanItem(id: number) {
  const db = await getDb();
  await db.runAsync('DELETE FROM plan_items WHERE id = ?', id);
}

// ---------------------------------------------------------------------------
// Workout logs (what you actually did)
// ---------------------------------------------------------------------------

export type LoggedSet = { reps: number; weight: number };
export type LogExercise = {
  exerciseId: number;
  name: string;
  muscle: string;
  sets: LoggedSet[];
};

/** Saved log for a date, or null if nothing has been saved for it. */
export async function getLogForDate(date: string): Promise<LogExercise[] | null> {
  const db = await getDb();
  const rows = await db.getAllAsync<{
    exerciseId: number;
    name: string;
    muscle: string;
    reps: number;
    weight: number;
  }>(
    `SELECT l.exercise_id AS exerciseId, e.name, e.muscle, l.reps, l.weight
       FROM set_logs l
       JOIN exercises e ON e.id = l.exercise_id
      WHERE l.date = ?
      ORDER BY l.exercise_order, l.set_number`,
    date
  );
  if (rows.length === 0) return null;

  const out: LogExercise[] = [];
  for (const r of rows) {
    const last = out[out.length - 1];
    const set = { reps: r.reps, weight: r.weight };
    if (last && last.exerciseId === r.exerciseId) last.sets.push(set);
    else out.push({ exerciseId: r.exerciseId, name: r.name, muscle: r.muscle, sets: [set] });
  }
  return out;
}

/** The plan for a weekday expanded into one row per set, used to prefill a new log. */
export async function getPlanAsLog(day: number): Promise<LogExercise[]> {
  const plan = await getPlanForDay(day);
  return plan.map((p) => ({
    exerciseId: p.exerciseId,
    name: p.name,
    muscle: p.muscle,
    sets: Array.from({ length: p.sets }, () => ({ reps: p.reps, weight: p.weight })),
  }));
}

/** Replaces everything logged for that date in one transaction. */
export async function saveLog(date: string, exercises: LogExercise[]) {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM set_logs WHERE date = ?', date);
    for (let i = 0; i < exercises.length; i++) {
      const ex = exercises[i];
      for (let j = 0; j < ex.sets.length; j++) {
        await db.runAsync(
          `INSERT INTO set_logs (date, exercise_id, exercise_order, set_number, reps, weight)
           VALUES (?, ?, ?, ?, ?, ?)`,
          date,
          ex.exerciseId,
          i,
          j + 1,
          ex.sets[j].reps,
          ex.sets[j].weight
        );
      }
    }
  });
}

export type SetLogRow = {
  date: string;
  exercise: string;
  muscle: string;
  setNumber: number;
  reps: number;
  weight: number;
};

export async function getAllSetLogs(): Promise<SetLogRow[]> {
  const db = await getDb();
  return db.getAllAsync<SetLogRow>(
    `SELECT l.date, e.name AS exercise, e.muscle, l.set_number AS setNumber, l.reps, l.weight
       FROM set_logs l
       JOIN exercises e ON e.id = l.exercise_id
      ORDER BY l.date, l.exercise_order, l.set_number`
  );
}
