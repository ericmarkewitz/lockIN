import type { Db } from '@/db/types';
import { addDays, addMonths, startOfMonth, startOfWeek, todayKey, type DateKey } from '@/lib/dates';
import { estimateOneRepMax } from '@/lib/strength';
import type { StatsRange } from './settings';
import { LOGGED_SET } from './logged';

const FROM_LOGGED_SETS = `
  FROM sets s
  JOIN workout_exercises we ON we.id = s.workout_exercise_id
  JOIN workouts w ON w.id = we.workout_id
  JOIN exercises e ON e.id = we.exercise_id
  JOIN categories c ON c.id = e.category_id`;

/** Weight × reps of a strength set, 0 when either is missing. Weight is stored in lb. */
const SET_VOLUME = "CASE WHEN c.kind = 'strength' THEN COALESCE(s.weight, 0) * COALESCE(s.reps, 0) ELSE 0 END";

export type LifetimeStats = {
  /** Days with at least one logged set. */
  workouts: number;
  /** Logged strength sets; cardio and mind-body entries are not sets. */
  sets: number;
  /** Total weight × reps across strength sets, in lb. Bodyweight sets add nothing. */
  volume: number;
  /** Distinct exercises ever logged, of any kind. */
  exercises: number;
};

export async function getLifetimeStats(db: Db): Promise<LifetimeStats> {
  const row = await db.getFirstAsync<LifetimeStats>(
    `SELECT COUNT(DISTINCT w.id) AS workouts,
            COALESCE(SUM(c.kind = 'strength'), 0) AS sets,
            COALESCE(SUM(${SET_VOLUME}), 0) AS volume,
            COUNT(DISTINCT e.id) AS exercises
     ${FROM_LOGGED_SETS}
     WHERE ${LOGGED_SET}`,
  );
  return row ?? { workouts: 0, sets: 0, volume: 0, exercises: 0 };
}

export type Bucket = 'week' | 'month';
export type RangeOpts = { range: StatsRange; today?: DateKey };

/** Weeks for the short ranges, months for the long ones. Counts include the current week or month. */
const WINDOWS: Record<Exclude<StatsRange, 'all'>, { bucket: Bucket; count: number }> = {
  '1m': { bucket: 'week', count: 5 },
  '3m': { bucket: 'week', count: 13 },
  '6m': { bucket: 'month', count: 6 },
  '1y': { bucket: 'month', count: 12 },
};

const bucketStart = (bucket: Bucket, date: DateKey) => (bucket === 'week' ? startOfWeek(date) : startOfMonth(date));
const nextBucket = (bucket: Bucket, start: DateKey) => (bucket === 'week' ? addDays(start, 7) : addMonths(start, 1));

/** The first day a range covers, or null for all time. Both charts start here, so they always agree. */
function rangeStart(range: StatsRange, today: DateKey): DateKey | null {
  if (range === 'all') return null;
  const { bucket, count } = WINDOWS[range];
  return bucket === 'week' ? addDays(startOfWeek(today), -7 * (count - 1)) : addMonths(startOfMonth(today), -(count - 1));
}

async function firstLoggedDate(db: Db): Promise<DateKey | null> {
  const row = await db.getFirstAsync<{ date: DateKey | null }>(
    `SELECT MIN(w.date) AS date ${FROM_LOGGED_SETS} WHERE ${LOGGED_SET}`,
  );
  return row?.date ?? null;
}

export type VolumeBar = { start: DateKey; volume: number };
export type VolumeSeries = { bucket: Bucket; bars: VolumeBar[] };

/**
 * Strength volume (lb) per week or month over `range`, oldest first, ending with the current one.
 * Weeks are Monday-first. All time starts at the month of the first logged workout.
 */
export async function getVolumeSeries(db: Db, { range, today = todayKey() }: RangeOpts): Promise<VolumeSeries> {
  const bucket: Bucket = range === 'all' ? 'month' : WINDOWS[range].bucket;
  const last = bucketStart(bucket, today);
  const first = range === 'all' ? startOfMonth((await firstLoggedDate(db)) ?? today) : rangeStart(range, today)!;
  const bars: VolumeBar[] = [];
  for (let start = first; start <= last; start = nextBucket(bucket, start)) bars.push({ start, volume: 0 });

  const rows = await db.getAllAsync<{ date: DateKey; volume: number }>(
    `SELECT w.date, SUM(${SET_VOLUME}) AS volume
     ${FROM_LOGGED_SETS}
     WHERE ${LOGGED_SET} AND w.date >= ? AND w.date <= ?
     GROUP BY w.date`,
    [first, today],
  );
  const byStart = new Map(bars.map((b) => [b.start, b]));
  for (const r of rows) {
    const bar = byStart.get(bucketStart(bucket, r.date));
    if (bar) bar.volume += r.volume;
  }
  return { bucket, bars };
}

export type TrendPoint = { date: DateKey; oneRepMax: number };

type TrendGroup = Bucket | 'session';

/**
 * 1M and 3M show every session; 6M and 1Y keep the best session of each week. All time depends on how far
 * back the lift goes, so a short history isn't squeezed into a couple of monthly points.
 */
function trendGroup(range: StatsRange, firstDate: DateKey | undefined, today: DateKey): TrendGroup {
  if (range === '1m' || range === '3m') return 'session';
  if (range !== 'all') return 'week';
  if (!firstDate || firstDate >= addMonths(today, -3)) return 'session';
  return firstDate >= addMonths(today, -12) ? 'week' : 'month';
}

/**
 * A lift's estimated 1RM (lb, Epley) over `range`, oldest first: the best set of each session,
 * thinned to the best session per week or month for long ranges so the line stays readable (see `trendGroup`).
 */
export async function getLiftTrend(db: Db, exerciseId: number, { range, today = todayKey() }: RangeOpts): Promise<TrendPoint[]> {
  const from = rangeStart(range, today);
  const params: unknown[] = [exerciseId, today];
  if (from) params.push(from);
  const rows = await db.getAllAsync<{ date: DateKey; weight: number; reps: number }>(
    `SELECT w.date, s.weight, s.reps
     ${FROM_LOGGED_SETS}
     WHERE we.exercise_id = ? AND ${LOGGED_SET} AND s.weight > 0 AND s.reps > 0 AND w.date <= ?
       ${from ? 'AND w.date >= ?' : ''}
     ORDER BY w.date`,
    params,
  );
  const group = trendGroup(range, rows[0]?.date, today);
  const best = new Map<string, TrendPoint>();
  for (const r of rows) {
    const e1 = estimateOneRepMax(r.weight, r.reps)!;
    const key = group === 'session' ? r.date : bucketStart(group, r.date);
    const cur = best.get(key);
    if (!cur || e1 > cur.oneRepMax) best.set(key, { date: r.date, oneRepMax: e1 });
  }
  return [...best.values()];
}

export type TrackedLift = { id: number; name: string; sessions: number };

/** Strength exercises with a weighted set on at least two days, enough to draw a trend. Most sessions first. */
export async function listTrackedLifts(db: Db): Promise<TrackedLift[]> {
  return db.getAllAsync<TrackedLift>(
    `SELECT e.id, e.name, COUNT(DISTINCT w.id) AS sessions
     ${FROM_LOGGED_SETS}
     WHERE ${LOGGED_SET} AND c.kind = 'strength' AND s.weight > 0 AND s.reps > 0
     GROUP BY e.id
     HAVING sessions >= 2
     ORDER BY sessions DESC, e.name`,
  );
}
