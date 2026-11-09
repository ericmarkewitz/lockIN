import type { Db } from '@/db/types';
import { estimateOneRepMax } from '@/lib/strength';
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

export type LoggedExercise = { id: number; name: string; kind: CategoryKind; sessions: number; lastDate: string };

/** Exercises with logged history, most recently performed first. */
export async function listLoggedExercises(db: Db): Promise<LoggedExercise[]> {
  return db.getAllAsync<LoggedExercise>(
    `SELECT e.id, e.name, c.kind, COUNT(DISTINCT w.id) AS sessions, MAX(w.date) AS lastDate
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     JOIN categories c ON c.id = e.category_id
     WHERE ${LOGGED_SET}
     GROUP BY e.id
     ORDER BY lastDate DESC, e.name`,
  );
}

export type ExerciseSession = {
  date: string;
  setCount: number;
  /** Heaviest logged set (ties go to more reps). Null when no set has weight and reps. */
  best: { weight: number; reps: number } | null;
  /** Highest Epley estimate across the session's sets. */
  estimatedOneRepMax: number | null;
  durationMin: number | null;
  distance: number | null;
};

/** One entry per workout the exercise was logged in, newest first. */
export async function getExerciseHistory(db: Db, exerciseId: number): Promise<ExerciseSession[]> {
  const rows = await db.getAllAsync<{
    date: string; weight: number | null; reps: number | null; duration_min: number | null; distance: number | null;
  }>(
    `SELECT w.date, s.weight, s.reps, s.duration_min, s.distance
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     WHERE we.exercise_id = ? AND ${LOGGED_SET}
     ORDER BY w.date DESC, s.set_number`,
    [exerciseId],
  );
  const sessions = new Map<string, ExerciseSession>();
  for (const r of rows) {
    const s = sessions.get(r.date) ?? { date: r.date, setCount: 0, best: null, estimatedOneRepMax: null, durationMin: null, distance: null };
    s.setCount += 1;
    if (r.weight && r.reps) {
      if (!s.best || r.weight > s.best.weight || (r.weight === s.best.weight && r.reps > s.best.reps)) {
        s.best = { weight: r.weight, reps: r.reps };
      }
      const e1 = estimateOneRepMax(r.weight, r.reps);
      if (e1 !== null && (s.estimatedOneRepMax === null || e1 > s.estimatedOneRepMax)) s.estimatedOneRepMax = e1;
    }
    if (r.duration_min !== null) s.durationMin = (s.durationMin ?? 0) + r.duration_min;
    if (r.distance !== null) s.distance = Math.round(((s.distance ?? 0) + r.distance) * 1000) / 1000;
    sessions.set(r.date, s);
  }
  return [...sessions.values()];
}
