import type { Db } from '@/db/types';
import { estimateOneRepMax } from '@/lib/strength';
import { parseFields, type FieldId } from './fields';
import { LOGGED_SET } from './logged';
import type { CategoryKind } from './types';

/** `setCount` counts strength sets only; cardio, yoga and mobility log entries, not sets. */
export type LoggedWorkout = { date: string; exerciseNames: string[]; setCount: number };

/** Workouts with at least one logged set, newest first. `before` is an exclusive date cursor for paging. */
export async function listLoggedWorkouts(
  db: Db, opts: { limit?: number; before?: string } = {},
): Promise<LoggedWorkout[]> {
  const where = [LOGGED_SET];
  const params: unknown[] = [];
  if (opts.before) { where.push('w.date < ?'); params.push(opts.before); }
  const rows = await db.getAllAsync<{ date: string; name: string; sets: number }>(
    `SELECT w.date, e.name, SUM(c.kind = 'strength') AS sets
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     JOIN categories c ON c.id = e.category_id
     WHERE ${where.join(' AND ')}
     GROUP BY w.date, we.id
     ORDER BY w.date DESC, we.position, we.id`,
    params,
  );
  const byDate = new Map<string, LoggedWorkout>();
  for (const r of rows) {
    const w = byDate.get(r.date) ?? { date: r.date, exerciseNames: [], setCount: 0 };
    w.exerciseNames.push(r.name);
    w.setCount += r.sets;
    byDate.set(r.date, w);
  }
  const list = [...byDate.values()];
  return opts.limit ? list.slice(0, opts.limit) : list;
}

export type LoggedExercise = {
  id: number; name: string; kind: CategoryKind; sessions: number; lastDate: string;
  /** What it records now, which decides how its sessions are summed up. */
  fields: FieldId[];
};

/** Exercises with logged history, most recently performed first. */
export async function listLoggedExercises(db: Db): Promise<LoggedExercise[]> {
  const rows = await db.getAllAsync<Omit<LoggedExercise, 'fields'> & { fields: string | null }>(
    `SELECT e.id, e.name, c.kind, e.fields, COUNT(DISTINCT w.id) AS sessions, MAX(w.date) AS lastDate
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     JOIN categories c ON c.id = e.category_id
     WHERE ${LOGGED_SET}
     GROUP BY e.id
     ORDER BY lastDate DESC, e.name`,
  );
  return rows.map((r) => ({ ...r, fields: parseFields(r.fields, r.kind) }));
}

export type ExerciseSession = {
  date: string;
  setCount: number;
  /** Heaviest logged set (ties go to more reps). Null when no set has weight and reps. */
  best: { weight: number; reps: number } | null;
  /** Highest Epley estimate across the session's sets. */
  estimatedOneRepMax: number | null;
  /** Heaviest weight logged, with or without reps: a weighted hold or carry has none. */
  heaviest: number | null;
  /** Total time across the session's sets, and the longest one (a lift's longest hold). */
  durationMin: number | null;
  longestMin: number | null;
  distance: number | null;
  /** Totals across the session's sets. */
  count: number | null;
  elevation: number | null;
  score: number | null;
  /** The hardest the session was rated. */
  difficulty: number | null;
};

/** One entry per workout the exercise was logged in, newest first. */
export async function getExerciseHistory(db: Db, exerciseId: number): Promise<ExerciseSession[]> {
  const rows = await db.getAllAsync<{
    date: string; weight: number | null; reps: number | null; duration_min: number | null; distance: number | null;
    count: number | null; elevation: number | null; score: number | null; difficulty: number | null;
  }>(
    `SELECT w.date, s.weight, s.reps, s.duration_min, s.distance, s.count, s.elevation, s.score, s.difficulty
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND ${LOGGED_SET}
     ORDER BY w.date DESC, s.set_number`,
    [exerciseId],
  );
  const sum = (a: number | null, b: number | null) => (b === null ? a : (a ?? 0) + b);
  const max = (a: number | null, b: number | null) => (b === null ? a : Math.max(a ?? b, b));
  const sessions = new Map<string, ExerciseSession>();
  for (const r of rows) {
    const s = sessions.get(r.date) ?? {
      date: r.date, setCount: 0, best: null, estimatedOneRepMax: null, heaviest: null, durationMin: null, longestMin: null,
      distance: null, count: null, elevation: null, score: null, difficulty: null,
    };
    s.setCount += 1;
    if (r.weight && r.reps) {
      if (!s.best || r.weight > s.best.weight || (r.weight === s.best.weight && r.reps > s.best.reps)) {
        s.best = { weight: r.weight, reps: r.reps };
      }
      const e1 = estimateOneRepMax(r.weight, r.reps);
      if (e1 !== null && (s.estimatedOneRepMax === null || e1 > s.estimatedOneRepMax)) s.estimatedOneRepMax = e1;
    }
    s.heaviest = max(s.heaviest, r.weight || null);
    s.durationMin = sum(s.durationMin, r.duration_min);
    s.longestMin = max(s.longestMin, r.duration_min);
    // Rounded to hide float noise in the sum; six places keep a swim's yards exact.
    if (r.distance !== null) s.distance = Math.round(((s.distance ?? 0) + r.distance) * 1e6) / 1e6;
    s.count = sum(s.count, r.count);
    s.elevation = sum(s.elevation, r.elevation);
    s.score = sum(s.score, r.score);
    s.difficulty = max(s.difficulty, r.difficulty);
    sessions.set(r.date, s);
  }
  return [...sessions.values()];
}
