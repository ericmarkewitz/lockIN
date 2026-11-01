import { datesInRange, weekdayOf } from '@/lib/dates';
import type { Db } from '@/db/types';
import { getPlan } from './plan';
import type {
  CategoryKind, DaySummary, DayStatus, Targets, Workout, WorkoutExercise, WorkoutSet,
} from './types';

type WeRow = {
  id: number; exercise_id: number; position: number; target_sets: number | null; target_reps: number | null;
  target_duration_min: number | null; target_distance: number | null;
  exercise_name: string; category_name: string; category_kind: CategoryKind;
};
type SetRow = {
  id: number; workout_exercise_id: number; set_number: number; target_reps: number | null; reps: number | null;
  weight: number | null; duration_min: number | null; distance: number | null; completed: number;
};

const toSet = (s: SetRow): WorkoutSet => ({
  id: s.id,
  setNumber: s.set_number,
  targetReps: s.target_reps,
  reps: s.reps,
  weight: s.weight,
  durationMin: s.duration_min,
  distance: s.distance,
  completed: !!s.completed,
});

export async function getWorkout(db: Db, date: string): Promise<Workout | null> {
  const w = await db.getFirstAsync<{ id: number; date: string; is_rest: number; notes: string | null }>(
    'SELECT id, date, is_rest, notes FROM workouts WHERE date = ?',
    [date],
  );
  if (!w) return null;
  const wes = await db.getAllAsync<WeRow>(
    `SELECT we.*, e.name AS exercise_name, c.name AS category_name, c.kind AS category_kind
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id JOIN categories c ON c.id = e.category_id
     WHERE we.workout_id = ? ORDER BY we.position, we.id`,
    [w.id],
  );
  const sets = await db.getAllAsync<SetRow>(
    `SELECT s.* FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? ORDER BY s.set_number`,
    [w.id],
  );
  const exercises: WorkoutExercise[] = wes.map((we) => ({
    id: we.id,
    exerciseId: we.exercise_id,
    exerciseName: we.exercise_name,
    categoryName: we.category_name,
    categoryKind: we.category_kind,
    position: we.position,
    targetSets: we.target_sets,
    targetReps: we.target_reps,
    targetDurationMin: we.target_duration_min,
    targetDistance: we.target_distance,
    sets: sets.filter((s) => s.workout_exercise_id === we.id).map(toSet),
  }));
  return { id: w.id, date: w.date, isRest: !!w.is_rest, notes: w.notes, exercises };
}

/** Number of set rows to pre-create: strength uses target sets, others get one row. */
function initialSetCount(kind: CategoryKind, t: Targets): number {
  return kind === 'strength' ? Math.max(t.targetSets ?? 1, 1) : 1;
}

async function insertWorkoutExercise(
  db: Db, workoutId: number, exerciseId: number, position: number, t: Targets,
): Promise<number> {
  const cat = await db.getFirstAsync<{ kind: CategoryKind }>(
    'SELECT c.kind FROM exercises e JOIN categories c ON c.id = e.category_id WHERE e.id = ?',
    [exerciseId],
  );
  if (!cat) throw new Error(`Unknown exercise ${exerciseId}`);
  const { lastInsertRowId } = await db.runAsync(
    `INSERT INTO workout_exercises (workout_id, exercise_id, position, target_sets, target_reps, target_duration_min, target_distance)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [workoutId, exerciseId, position, t.targetSets ?? null, t.targetReps ?? null, t.targetDurationMin ?? null, t.targetDistance ?? null],
  );
  const n = initialSetCount(cat.kind, t);
  for (let i = 1; i <= n; i++) {
    await db.runAsync('INSERT INTO sets (workout_exercise_id, set_number, target_reps) VALUES (?, ?, ?)', [
      lastInsertRowId, i, cat.kind === 'strength' ? t.targetReps ?? null : null,
    ]);
  }
  return lastInsertRowId;
}

/** Returns the workout for `date`, materializing it from the weekly plan on first access. */
export async function ensureWorkout(db: Db, date: string): Promise<Workout> {
  const existing = await getWorkout(db, date);
  if (existing) return existing;
  const day = (await getPlan(db)).find((d) => d.weekday === weekdayOf(date))!;
  await db.withTransactionAsync(async () => {
    const { lastInsertRowId } = await db.runAsync('INSERT INTO workouts (date, is_rest) VALUES (?, ?)', [
      date, day.isRest ? 1 : 0,
    ]);
    for (const [i, item] of day.items.entries()) {
      await insertWorkoutExercise(db, lastInsertRowId, item.exerciseId, i, item);
    }
  });
  return (await getWorkout(db, date))!;
}

export type SetPatch = {
  reps?: number | null;
  weight?: number | null;
  durationMin?: number | null;
  distance?: number | null;
  completed?: boolean;
};

const SET_COLUMNS: Record<keyof SetPatch, string> = {
  reps: 'reps', weight: 'weight', durationMin: 'duration_min', distance: 'distance', completed: 'completed',
};

/** `undefined` leaves a field unchanged; `null` clears it. */
export async function updateSet(db: Db, setId: number, patch: SetPatch): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(SET_COLUMNS) as (keyof SetPatch)[]) {
    const v = patch[key];
    if (v === undefined) continue;
    if (typeof v === 'number' && v < 0) throw new Error(`${key} cannot be negative`);
    sets.push(`${SET_COLUMNS[key]} = ?`);
    params.push(key === 'completed' ? (v ? 1 : 0) : v);
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE sets SET ${sets.join(', ')} WHERE id = ?`, [...params, setId]);
}

export async function addSet(db: Db, workoutExerciseId: number): Promise<void> {
  const r = await db.getFirstAsync<{ n: number | null; t: number | null }>(
    'SELECT MAX(set_number) AS n, (SELECT target_reps FROM workout_exercises WHERE id = ?) AS t FROM sets WHERE workout_exercise_id = ?',
    [workoutExerciseId, workoutExerciseId],
  );
  await db.runAsync('INSERT INTO sets (workout_exercise_id, set_number, target_reps) VALUES (?, ?, ?)', [
    workoutExerciseId, (r?.n ?? 0) + 1, r?.t ?? null,
  ]);
}

export async function removeSet(db: Db, setId: number): Promise<void> {
  const s = await db.getFirstAsync<{ workout_exercise_id: number }>(
    'SELECT workout_exercise_id FROM sets WHERE id = ?', [setId],
  );
  if (!s) return;
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sets WHERE id = ?', [setId]);
    const rest = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM sets WHERE workout_exercise_id = ? ORDER BY set_number', [s.workout_exercise_id],
    );
    for (const [i, row] of rest.entries()) {
      await db.runAsync('UPDATE sets SET set_number = ? WHERE id = ?', [i + 1, row.id]);
    }
  });
}

export async function addExerciseToWorkout(
  db: Db, workoutId: number, exerciseId: number, targets: Targets = {},
): Promise<{ id: number }> {
  let id = 0;
  await db.withTransactionAsync(async () => {
    const r = await db.getFirstAsync<{ n: number | null }>(
      'SELECT MAX(position) AS n FROM workout_exercises WHERE workout_id = ?', [workoutId],
    );
    id = await insertWorkoutExercise(db, workoutId, exerciseId, (r?.n ?? -1) + 1, targets);
  });
  return { id };
}

export async function removeExerciseFromWorkout(db: Db, workoutExerciseId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await db.runAsync('DELETE FROM sets WHERE workout_exercise_id = ?', [workoutExerciseId]);
    await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', [workoutExerciseId]);
  });
}

export async function setRestDay(db: Db, date: string, isRest: boolean): Promise<void> {
  await ensureWorkout(db, date);
  await db.runAsync('UPDATE workouts SET is_rest = ? WHERE date = ?', [isRest ? 1 : 0, date]);
}

export async function setWorkoutNotes(db: Db, date: string, notes: string): Promise<void> {
  await ensureWorkout(db, date);
  await db.runAsync('UPDATE workouts SET notes = ? WHERE date = ?', [notes.trim() || null, date]);
}

/** Most recent workout before `beforeDate` with completed sets for this exercise. */
export async function getLastPerformance(
  db: Db, exerciseId: number, beforeDate: string,
): Promise<{ date: string; sets: WorkoutSet[] } | null> {
  const row = await db.getFirstAsync<{ date: string; we_id: number }>(
    `SELECT w.date, we.id AS we_id FROM workouts w
     JOIN workout_exercises we ON we.workout_id = w.id
     WHERE we.exercise_id = ? AND w.date < ?
       AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND s.completed = 1)
     ORDER BY w.date DESC LIMIT 1`,
    [exerciseId, beforeDate],
  );
  if (!row) return null;
  const sets = await db.getAllAsync<SetRow>(
    'SELECT * FROM sets WHERE workout_exercise_id = ? AND completed = 1 ORDER BY set_number', [row.we_id],
  );
  return { date: row.date, sets: sets.map(toSet) };
}

/** Status for each date in [from, to]: logged workouts win, otherwise the weekly plan is used. */
export async function getRangeSummary(db: Db, from: string, to: string, today: string): Promise<DaySummary[]> {
  const plan = await getPlan(db);
  const rows = await db.getAllAsync<{
    date: string; is_rest: number; kind: CategoryKind | null; we_id: number | null;
    total: number | null; done: number | null;
  }>(
    `SELECT w.date, w.is_rest, c.kind, we.id AS we_id,
       (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id) AS total,
       (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id AND s.completed = 1) AS done
     FROM workouts w
     LEFT JOIN workout_exercises we ON we.workout_id = w.id
     LEFT JOIN exercises e ON e.id = we.exercise_id
     LEFT JOIN categories c ON c.id = e.category_id
     WHERE w.date BETWEEN ? AND ? ORDER BY w.date, we.position`,
    [from, to],
  );
  const byDate = new Map<string, typeof rows>();
  for (const r of rows) byDate.set(r.date, [...(byDate.get(r.date) ?? []), r]);

  return datesInRange(from, to).map((date): DaySummary => {
    const logged = byDate.get(date);
    const unfinished = (): DayStatus => (date < today ? 'missed' : 'planned');
    if (logged) {
      if (logged[0].is_rest) return { date, status: 'rest', exerciseCount: 0, kinds: [] };
      const ex = logged.filter((r) => r.we_id !== null);
      const kinds = [...new Set(ex.map((r) => r.kind!))];
      if (!ex.length) return { date, status: 'none', exerciseCount: 0, kinds: [] };
      const done = ex.reduce((n, r) => n + (r.done ?? 0), 0);
      const total = ex.reduce((n, r) => n + (r.total ?? 0), 0);
      const status: DayStatus = done === 0 ? unfinished() : done >= total ? 'completed' : 'partial';
      return { date, status, exerciseCount: ex.length, kinds };
    }
    const day = plan.find((d) => d.weekday === weekdayOf(date))!;
    if (day.isRest) return { date, status: 'rest', exerciseCount: 0, kinds: [] };
    if (!day.items.length) return { date, status: 'none', exerciseCount: 0, kinds: [] };
    return {
      date,
      status: unfinished(),
      exerciseCount: day.items.length,
      kinds: [...new Set(day.items.map((i) => i.categoryKind))],
    };
  });
}

/** After a plan edit: drop future workouts with nothing logged so they regenerate from the new plan. */
export async function refreshUntouchedWorkouts(db: Db, fromDate: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM workouts WHERE date >= ? AND notes IS NULL AND NOT EXISTS (
       SELECT 1 FROM workout_exercises we JOIN sets s ON s.workout_exercise_id = we.id
       WHERE we.workout_id = workouts.id AND (s.completed = 1 OR s.weight IS NOT NULL OR s.reps IS NOT NULL
         OR s.duration_min IS NOT NULL OR s.distance IS NOT NULL))`,
    [fromDate],
  );
}
