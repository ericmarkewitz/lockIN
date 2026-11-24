import { datesInRange, weekdayOf } from '@/lib/dates';
import type { Db } from '@/db/types';
import { normalizeFields, resolveFields, serializeFields, type FieldId } from './fields';
import { LOGGED_SET } from './logged';
import { getPlan, getPlanHistory } from './plan';
import { DISTANCE_UNITS, getUnits, WEIGHT_UNITS, type DistanceUnit, type WeightUnit } from './settings';
import type {
  CategoryKind, DaySummary, DayStatus, PlanDay, Targets, Workout, WorkoutExercise, WorkoutSet,
} from './types';

type WeRow = {
  id: number; exercise_id: number; position: number; target_sets: number | null; target_reps: number | null;
  target_duration_min: number | null; target_distance: number | null; target_count: number | null;
  exercise_name: string; is_custom: number; category_name: string; category_kind: CategoryKind; subcategory: string | null;
  fields: string | null; exercise_fields: string | null; exercise_builtin_fields: string | null; has_logged_sets: number;
};
type SetRow = {
  id: number; workout_exercise_id: number; set_number: number; target_reps: number | null; reps: number | null;
  weight: number | null; duration_min: number | null; distance: number | null; completed: number; is_logged: number;
  count: number | null; elevation: number | null; score: number | null; difficulty: number | null;
  weight_unit: WeightUnit | null; distance_unit: DistanceUnit | null;
};

/** Selects a `SetRow`. The query must alias the `sets` table as `s`. */
const SET_FIELDS = `s.*, ${LOGGED_SET} AS is_logged`;

const toSet = (s: SetRow): WorkoutSet => ({
  id: s.id,
  setNumber: s.set_number,
  targetReps: s.target_reps,
  reps: s.reps,
  weight: s.weight,
  durationMin: s.duration_min,
  distance: s.distance,
  count: s.count,
  elevation: s.elevation,
  score: s.score,
  difficulty: s.difficulty,
  weightUnit: s.weight_unit,
  distanceUnit: s.distance_unit,
  completed: !!s.completed,
  isLogged: !!s.is_logged,
});

export async function getWorkout(db: Db, date: string): Promise<Workout | null> {
  const w = await db.getFirstAsync<{ id: number; date: string; is_rest: number; notes: string | null }>(
    'SELECT id, date, is_rest, notes FROM workouts WHERE date = ?',
    [date],
  );
  if (!w) return null;
  const wes = await db.getAllAsync<WeRow>(
    `SELECT we.*, e.name AS exercise_name, e.is_custom, e.subcategory, e.fields AS exercise_fields,
       e.builtin_fields AS exercise_builtin_fields, c.name AS category_name, c.kind AS category_kind,
       EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND ${LOGGED_SET}) AS has_logged_sets
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id JOIN categories c ON c.id = e.category_id
     WHERE we.workout_id = ? ORDER BY we.position, we.id`,
    [w.id],
  );
  const sets = await db.getAllAsync<SetRow>(
    `SELECT ${SET_FIELDS} FROM sets s JOIN workout_exercises we ON we.id = s.workout_exercise_id
     WHERE we.workout_id = ? ORDER BY s.set_number`,
    [w.id],
  );
  const exercises: WorkoutExercise[] = wes.map((we) => ({
    id: we.id,
    exerciseId: we.exercise_id,
    exerciseName: we.exercise_name,
    categoryName: we.category_name,
    categoryKind: we.category_kind,
    subcategory: we.subcategory,
    position: we.position,
    targetSets: we.target_sets,
    targetReps: we.target_reps,
    targetDurationMin: we.target_duration_min,
    targetDistance: we.target_distance,
    targetCount: we.target_count,
    fields: resolveFields(we.category_kind, we.fields, we.exercise_fields, we.exercise_builtin_fields),
    defaultFields: resolveFields(we.category_kind, we.exercise_fields, we.exercise_builtin_fields),
    hasLoggedSets: !!we.has_logged_sets,
    isCustom: !!we.is_custom,
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
  /** What this day records for it, e.g. its plan item's pick; null follows the exercise's default. */
  fields: readonly FieldId[] | null = null,
): Promise<number> {
  const cat = await db.getFirstAsync<{ kind: CategoryKind }>(
    'SELECT c.kind FROM exercises e JOIN categories c ON c.id = e.category_id WHERE e.id = ?',
    [exerciseId],
  );
  if (!cat) throw new Error(`Unknown exercise ${exerciseId}`);
  const { lastInsertRowId } = await db.runAsync(
    `INSERT INTO workout_exercises (workout_id, exercise_id, position, target_sets, target_reps, target_duration_min, target_distance, target_count, fields)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      workoutId, exerciseId, position, t.targetSets ?? null, t.targetReps ?? null, t.targetDurationMin ?? null,
      t.targetDistance ?? null, t.targetCount ?? null, fields && serializeFields(fields),
    ],
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
/**
 * The plan to fill in a new workout for `date`. Days before the latest plan save use the plan they
 * had: nothing before the first save, and rest or nothing where that plan said so. The history
 * keeps no exercise lists, so a day that had exercises then gets today's.
 */
async function planDayFor(db: Db, date: string): Promise<{ isRest: boolean; items: PlanDay['items'] }> {
  const weekday = weekdayOf(date);
  const current = (await getPlan(db)).find((d) => d.weekday === weekday)!;
  const history = await getPlanHistory(db); // newest first
  if (!history.length || date >= history[0].effectiveFrom) return current;
  const then = history.find((h) => h.weekday === weekday && h.effectiveFrom <= date);
  if (!then || !then.exerciseCount) return { isRest: !!then?.isRest, items: [] };
  return current;
}

export async function ensureWorkout(db: Db, date: string): Promise<Workout> {
  const existing = await getWorkout(db, date);
  if (existing) return existing;
  const day = await planDayFor(db, date);
  await db.withTransactionAsync(async () => {
    const { lastInsertRowId } = await db.runAsync('INSERT INTO workouts (date, is_rest) VALUES (?, ?)', [
      date, day.isRest ? 1 : 0,
    ]);
    for (const [i, item] of day.items.entries()) {
      await insertWorkoutExercise(db, lastInsertRowId, item.exerciseId, i, item, item.ownFields);
    }
  });
  return (await getWorkout(db, date))!;
}

export type SetPatch = {
  reps?: number | null;
  weight?: number | null;
  durationMin?: number | null;
  distance?: number | null;
  /** A whole number: steps, runs, routes or the like. */
  count?: number | null;
  /** Feet. */
  elevation?: number | null;
  /** A whole number. */
  score?: number | null;
  /** A whole number from 1 to 10. */
  difficulty?: number | null;
  /** The unit `weight`/`distance` were entered in; they are still passed in lb and mi. */
  weightUnit?: WeightUnit | null;
  distanceUnit?: DistanceUnit | null;
  completed?: boolean;
};

const SET_COLUMNS: Record<keyof SetPatch, string> = {
  reps: 'reps', weight: 'weight', durationMin: 'duration_min', distance: 'distance',
  count: 'count', elevation: 'elevation', score: 'score', difficulty: 'difficulty',
  weightUnit: 'weight_unit', distanceUnit: 'distance_unit', completed: 'completed',
};

const WHOLE_NUMBERS: readonly (keyof SetPatch)[] = ['count', 'score'];

const ALLOWED_UNITS: Partial<Record<keyof SetPatch, readonly string[]>> = { weightUnit: WEIGHT_UNITS, distanceUnit: DISTANCE_UNITS };

/** `undefined` leaves a field unchanged; `null` clears it. */
export async function updateSet(db: Db, setId: number, patch: SetPatch): Promise<void> {
  const sets: string[] = [];
  const params: unknown[] = [];
  for (const key of Object.keys(SET_COLUMNS) as (keyof SetPatch)[]) {
    const v = patch[key];
    if (v === undefined) continue;
    if (typeof v === 'number' && v < 0) throw new Error(`${key} cannot be negative`);
    if (typeof v === 'number' && WHOLE_NUMBERS.includes(key) && !Number.isInteger(v)) throw new Error(`${key} must be a whole number`);
    if (key === 'difficulty' && v !== null && !(Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 10)) {
      throw new Error('Difficulty is from 1 to 10');
    }
    if (typeof v === 'string' && !ALLOWED_UNITS[key]?.includes(v)) throw new Error(`Unsupported ${key}: ${v}`);
    sets.push(`${SET_COLUMNS[key]} = ?`);
    params.push(key === 'completed' ? (v ? 1 : 0) : v);
  }
  if (!sets.length) return;
  await db.runAsync(`UPDATE sets SET ${sets.join(', ')} WHERE id = ?`, [...params, setId]);
}

/** Records that the user changed this workout's structure, so plan edits leave it alone. */
function markCustomizedByExercise(db: Db, workoutExerciseId: number) {
  return db.runAsync(
    'UPDATE workouts SET is_customized = 1 WHERE id = (SELECT workout_id FROM workout_exercises WHERE id = ?)',
    [workoutExerciseId],
  );
}

/**
 * Changes what a day records for one of its exercises, leaving the exercise's default and the plan
 * alone. Values already logged are kept. It counts as a change by hand, so plan edits keep it.
 */
export async function setWorkoutExerciseFields(db: Db, workoutExerciseId: number, fields: readonly FieldId[]): Promise<void> {
  const cat = await db.getFirstAsync<{ kind: CategoryKind }>(
    `SELECT c.kind FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     JOIN categories c ON c.id = e.category_id WHERE we.id = ?`,
    [workoutExerciseId],
  );
  if (!cat) throw new Error('Exercise not found in this workout');
  const stored = serializeFields(normalizeFields(fields, cat.kind));
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE workout_exercises SET fields = ? WHERE id = ?', [stored, workoutExerciseId]);
    await markCustomizedByExercise(db, workoutExerciseId);
  });
}

/** Strength only: cardio, yoga and mobility log a single entry per exercise. */
export async function addSet(db: Db, workoutExerciseId: number): Promise<void> {
  const cat = await db.getFirstAsync<{ kind: CategoryKind }>(
    `SELECT c.kind FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     JOIN categories c ON c.id = e.category_id WHERE we.id = ?`,
    [workoutExerciseId],
  );
  if (cat?.kind !== 'strength') throw new Error('Only strength exercises have sets');
  // Marked first: if the insert then fails, an extra flag only stops the day regenerating.
  await markCustomizedByExercise(db, workoutExerciseId);
  // The new set follows the last one's units, so a whole session at a kg gym stays in kg.
  const last = await db.getFirstAsync<{ n: number; weight_unit: string | null; distance_unit: string | null }>(
    'SELECT set_number AS n, weight_unit, distance_unit FROM sets WHERE workout_exercise_id = ? ORDER BY set_number DESC LIMIT 1',
    [workoutExerciseId],
  );
  const we = await db.getFirstAsync<{ t: number | null }>('SELECT target_reps AS t FROM workout_exercises WHERE id = ?', [workoutExerciseId]);
  await db.runAsync(
    'INSERT INTO sets (workout_exercise_id, set_number, target_reps, weight_unit, distance_unit) VALUES (?, ?, ?, ?, ?)',
    [workoutExerciseId, (last?.n ?? 0) + 1, we?.t ?? null, last?.weight_unit ?? null, last?.distance_unit ?? null],
  );
}

export async function removeSet(db: Db, setId: number): Promise<void> {
  const s = await db.getFirstAsync<{ workout_exercise_id: number }>(
    'SELECT workout_exercise_id FROM sets WHERE id = ?', [setId],
  );
  if (!s) return;
  await db.withTransactionAsync(async () => {
    await markCustomizedByExercise(db, s.workout_exercise_id);
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
    await db.runAsync('UPDATE workouts SET is_customized = 1 WHERE id = ?', [workoutId]);
  });
  return { id };
}

export async function removeExerciseFromWorkout(db: Db, workoutExerciseId: number): Promise<void> {
  await db.withTransactionAsync(async () => {
    await markCustomizedByExercise(db, workoutExerciseId);
    await db.runAsync('DELETE FROM sets WHERE workout_exercise_id = ?', [workoutExerciseId]);
    await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', [workoutExerciseId]);
  });
}

/**
 * Puts a day's exercises in the order of `ids`, with any it leaves out after them in their old order.
 * Only this day changes, never the plan; a new order counts as a change by hand, so plan edits keep it.
 */
export async function reorderWorkoutExercises(db: Db, workoutId: number, ids: readonly number[]): Promise<void> {
  await db.withTransactionAsync(async () => {
    const rows = await db.getAllAsync<{ id: number }>(
      'SELECT id FROM workout_exercises WHERE workout_id = ? ORDER BY position, id', [workoutId],
    );
    const current = rows.map((r) => r.id);
    const listed = [...new Set(ids)].filter((id) => current.includes(id));
    const order = [...listed, ...current.filter((id) => !listed.includes(id))];
    if (order.every((id, i) => id === current[i])) return;
    for (const [position, id] of order.entries()) {
      await db.runAsync('UPDATE workout_exercises SET position = ? WHERE id = ?', [position, id]);
    }
    await db.runAsync('UPDATE workouts SET is_customized = 1 WHERE id = ?', [workoutId]);
  });
}

/**
 * Swaps another exercise of the same category in for the sets of a day's exercise not logged yet,
 * e.g. when that lift can't be done today, with the same targets. With nothing logged it takes the
 * old one's place; otherwise the old one keeps its logged sets and the new one follows it. Only this
 * day changes, never the plan.
 */
export async function replaceWorkoutExercise(db: Db, workoutExerciseId: number, exerciseId: number): Promise<{ id: number }> {
  const old = await db.getFirstAsync<WeRow & { workout_id: number; category_id: number }>(
    `SELECT we.*, e.category_id, c.kind AS category_kind FROM workout_exercises we
     JOIN exercises e ON e.id = we.exercise_id JOIN categories c ON c.id = e.category_id WHERE we.id = ?`,
    [workoutExerciseId],
  );
  if (!old) throw new Error('Exercise not found in this workout');
  const next = await db.getFirstAsync<{ category_id: number }>('SELECT category_id FROM exercises WHERE id = ?', [exerciseId]);
  if (!next) throw new Error(`Unknown exercise ${exerciseId}`);
  if (next.category_id !== old.category_id) throw new Error('Swap in an exercise from the same category');
  const open = await db.getAllAsync<{ id: number }>(
    `SELECT s.id FROM sets s WHERE s.workout_exercise_id = ? AND NOT ${LOGGED_SET}`, [workoutExerciseId],
  );
  if (!open.length) throw new Error('Every set of this exercise is already done');
  const total = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM sets WHERE workout_exercise_id = ?', [workoutExerciseId]);
  const keepOld = open.length < total!.n;

  let id = 0;
  await db.withTransactionAsync(async () => {
    const order = (await db.getAllAsync<{ id: number }>(
      'SELECT id FROM workout_exercises WHERE workout_id = ? ORDER BY position, id', [old.workout_id],
    )).map((r) => r.id);
    id = await insertWorkoutExercise(db, old.workout_id, exerciseId, 0, {
      targetSets: old.category_kind === 'strength' ? open.length : old.target_sets,
      targetReps: old.target_reps,
      targetDurationMin: old.target_duration_min,
      targetDistance: old.target_distance,
      targetCount: old.target_count,
    });
    const at = order.indexOf(workoutExerciseId);
    if (keepOld) {
      for (const s of open) await db.runAsync('DELETE FROM sets WHERE id = ?', [s.id]);
      order.splice(at + 1, 0, id);
    } else {
      await db.runAsync('DELETE FROM sets WHERE workout_exercise_id = ?', [workoutExerciseId]);
      await db.runAsync('DELETE FROM workout_exercises WHERE id = ?', [workoutExerciseId]);
      order.splice(at, 1, id);
    }
    for (const [position, weId] of order.entries()) {
      await db.runAsync('UPDATE workout_exercises SET position = ? WHERE id = ?', [position, weId]);
    }
    await db.runAsync('UPDATE workouts SET is_customized = 1 WHERE id = ?', [old.workout_id]);
  });
  return { id };
}

const hasLogged = (db: Db, workoutId: number) => db.getFirstAsync(
  `SELECT 1 FROM workout_exercises we JOIN sets s ON s.workout_exercise_id = we.id
   WHERE we.workout_id = ? AND ${LOGGED_SET}`,
  [workoutId],
);

/**
 * Trades what two days hold, e.g. moving today's legs to Wednesday's rest: their exercises, targets
 * and rest flag. Each date keeps its notes. Only these two days change, never the plan, and both
 * count as changed by hand so plan edits leave them be. A day with anything logged can't move.
 */
export async function swapDays(db: Db, a: string, b: string): Promise<void> {
  if (a === b) throw new Error('Pick another day to swap with');
  const wa = await ensureWorkout(db, a);
  const wb = await ensureWorkout(db, b);
  for (const w of [wa, wb]) {
    if (await hasLogged(db, w.id)) throw new Error(`${w.date} already has sets logged`);
  }
  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE workout_exercises SET workout_id = CASE workout_id WHEN ? THEN ? ELSE ? END WHERE workout_id IN (?, ?)`,
      [wa.id, wb.id, wa.id, wa.id, wb.id],
    );
    await db.runAsync('UPDATE workouts SET is_rest = ?, is_customized = 1 WHERE id = ?', [wb.isRest ? 1 : 0, wa.id]);
    await db.runAsync('UPDATE workouts SET is_rest = ?, is_customized = 1 WHERE id = ?', [wa.isRest ? 1 : 0, wb.id]);
  });
}

export type DayPreview = { date: string; isRest: boolean; exercises: string[]; logged: boolean };

/** What each day holds, from its workout or else the plan, without creating any workouts. */
export async function previewDays(db: Db, dates: readonly string[]): Promise<DayPreview[]> {
  const out: DayPreview[] = [];
  for (const date of dates) {
    const w = await getWorkout(db, date);
    if (w) {
      out.push({
        date, isRest: w.isRest, exercises: shownExercises(w).map((e) => e.exerciseName), logged: !!(await hasLogged(db, w.id)),
      });
    } else {
      const day = await planDayFor(db, date);
      out.push({ date, isRest: day.isRest, exercises: day.isRest ? [] : day.items.map((i) => i.exerciseName), logged: false });
    }
  }
  return out;
}

export async function setRestDay(db: Db, date: string, isRest: boolean): Promise<void> {
  await ensureWorkout(db, date);
  await db.runAsync('UPDATE workouts SET is_rest = ?, is_customized = 1 WHERE date = ?', [isRest ? 1 : 0, date]);
}

export async function setWorkoutNotes(db: Db, date: string, notes: string): Promise<void> {
  await ensureWorkout(db, date);
  await db.runAsync('UPDATE workouts SET notes = ? WHERE date = ?', [notes.trim() || null, date]);
}

/** Most recent workout before `beforeDate` with logged sets for this exercise. */
export async function getLastPerformance(
  db: Db, exerciseId: number, beforeDate: string,
): Promise<{ date: string; sets: WorkoutSet[] } | null> {
  const row = await db.getFirstAsync<{ date: string; we_id: number }>(
    `SELECT w.date, we.id AS we_id FROM workouts w
     JOIN workout_exercises we ON we.workout_id = w.id
     WHERE we.exercise_id = ? AND w.date < ?
       AND EXISTS (SELECT 1 FROM sets s WHERE s.workout_exercise_id = we.id AND ${LOGGED_SET})
     ORDER BY w.date DESC LIMIT 1`,
    [exerciseId, beforeDate],
  );
  if (!row) return null;
  const sets = await db.getAllAsync<SetRow>(
    `SELECT ${SET_FIELDS} FROM sets s WHERE s.workout_exercise_id = ? AND ${LOGGED_SET} ORDER BY s.set_number`, [row.we_id],
  );
  return { date: row.date, sets: sets.map(toSet) };
}

/**
 * Status for each date in [from, to]. Logged workouts win; otherwise today and later follow the
 * current plan, and past days the plan that was in use on that date (none before the first save).
 */
export async function getRangeSummary(db: Db, from: string, to: string, today: string): Promise<DaySummary[]> {
  const plan = await getPlan(db);
  const history = await getPlanHistory(db); // newest first
  const first = history.at(-1)?.effectiveFrom;
  const beforePlan = (date: string) => date < today && (!first || date < first);
  const rows = await db.getAllAsync<{
    date: string; is_rest: number; kind: CategoryKind | null; we_id: number | null;
    total: number | null; done: number | null;
  }>(
    `SELECT w.date, w.is_rest, c.kind, we.id AS we_id,
       (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id) AS total,
       (SELECT COUNT(*) FROM sets s WHERE s.workout_exercise_id = we.id AND ${LOGGED_SET}) AS done
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
      const isRest = !!logged[0].is_rest;
      // A rest day only counts the exercises the user actually logged.
      const ex = logged.filter((r) => r.we_id !== null && (!isRest || r.done));
      const kinds = [...new Set(ex.map((r) => r.kind!))];
      if (!ex.length) {
        if (isRest) return { date, status: 'rest', exerciseCount: 0, kinds: [] };
        return { date, status: 'none', exerciseCount: 0, kinds: [], ...(beforePlan(date) && { beforePlan: true as const }) };
      }
      const done = ex.reduce((n, r) => n + (r.done ?? 0), 0);
      const total = ex.reduce((n, r) => n + (r.total ?? 0), 0);
      const status: DayStatus = done === 0 ? unfinished() : done >= total ? 'completed' : 'partial';
      return { date, status, exerciseCount: ex.length, kinds };
    }
    const weekday = weekdayOf(date);
    let day: { isRest: boolean; exerciseCount: number; kinds: CategoryKind[] };
    if (date < today) {
      const then = history.find((h) => h.weekday === weekday && h.effectiveFrom <= date);
      if (!then) return { date, status: 'none', exerciseCount: 0, kinds: [], beforePlan: true };
      day = then;
    } else {
      const now = plan.find((d) => d.weekday === weekday)!;
      day = { isRest: now.isRest, exerciseCount: now.items.length, kinds: [...new Set(now.items.map((i) => i.categoryKind))] };
    }
    if (day.isRest) return { date, status: 'rest', exerciseCount: 0, kinds: [] };
    if (!day.exerciseCount) return { date, status: 'none', exerciseCount: 0, kinds: [] };
    return { date, status: unfinished(), exerciseCount: day.exerciseCount, kinds: day.kinds };
  });
}

/** After a plan edit: drop future workouts with nothing logged or changed by hand so they regenerate from the new plan. */
export async function refreshUntouchedWorkouts(db: Db, fromDate: string): Promise<void> {
  await db.runAsync(
    `DELETE FROM workouts WHERE date >= ? AND notes IS NULL AND is_customized = 0 AND NOT EXISTS (
       SELECT 1 FROM workout_exercises we JOIN sets s ON s.workout_exercise_id = we.id
       WHERE we.workout_id = workouts.id AND ${LOGGED_SET})`,
    [fromDate],
  );
}

/** A day as the workout screens show it: its workout, the user's units, and each exercise's last performance. */
export async function loadDay(db: Db, date: string) {
  const workout = await ensureWorkout(db, date);
  const units = await getUnits(db);
  const last: Record<number, { date: string; sets: WorkoutSet[] } | null> = {};
  for (const e of workout.exercises) last[e.exerciseId] = await getLastPerformance(db, e.exerciseId, date);
  return { workout, units, last };
}

/** A rest day hides what was only planned, but never what was logged. */
export const shownExercises = (w: Workout) => (w.isRest ? w.exercises.filter((e) => e.hasLoggedSets) : w.exercises);
