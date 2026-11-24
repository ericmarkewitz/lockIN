import type { Db } from '@/db/types';
import { parseDateKey } from '@/lib/dates';
import { FIELDS, fieldFor, parseFields } from './fields';
import { LOGGED_SET } from './logged';
import { getUnits } from './settings';
import { roundMinutes } from '@/lib/duration';
import { elevationUnit, toDisplayDistance, toDisplayElevation, toDisplayWeight } from '@/lib/units';
import type { CategoryKind } from './types';
import { toCsv, type CsvColumn } from './csv';

export type ExportFieldKey =
  | 'date' | 'weekday' | 'category' | 'subcategory' | 'exercise' | 'set' | 'reps' | 'weight'
  | 'duration_min' | 'distance' | 'elevation' | 'count' | 'count_of' | 'score' | 'difficulty' | 'completed' | 'notes';

/**
 * Canonical column order. The weight, distance and elevation headers get the user's unit appended.
 * Distances are all in the user's distance unit, swims and rows too.
 */
export const EXPORT_FIELDS: { key: ExportFieldKey; header: string; label: string }[] = [
  { key: 'date', header: 'Date', label: 'Date' },
  { key: 'weekday', header: 'Weekday', label: 'Weekday' },
  { key: 'category', header: 'Category', label: 'Category' },
  { key: 'subcategory', header: 'Subcategory', label: 'Subcategory' },
  { key: 'exercise', header: 'Exercise', label: 'Exercise' },
  { key: 'set', header: 'Set', label: 'Set number' },
  { key: 'reps', header: 'Reps', label: 'Reps' },
  { key: 'weight', header: 'Weight', label: 'Weight' },
  { key: 'duration_min', header: 'Duration (min)', label: 'Duration' },
  { key: 'distance', header: 'Distance', label: 'Distance' },
  { key: 'elevation', header: 'Elevation gain', label: 'Elevation gain' },
  { key: 'count', header: 'Count', label: 'Count (steps, routes…)' },
  { key: 'count_of', header: 'Count of', label: 'What was counted' },
  { key: 'score', header: 'Score', label: 'Score' },
  { key: 'difficulty', header: 'Difficulty (1-10)', label: 'Difficulty' },
  { key: 'completed', header: 'Completed', label: 'Completed' },
  { key: 'notes', header: 'Notes', label: 'Workout notes' },
];

export type ExportOptions = {
  fields: ExportFieldKey[];
  /** Explicit dates; takes precedence over from/to. */
  dates?: string[];
  from?: string;
  to?: string;
  includeUnlogged?: boolean;
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type Row = {
  date: string; category: string; subcategory: string | null; exercise: string; set_number: number; reps: number | null;
  weight: number | null; duration_min: number | null; distance: number | null; completed: number; notes: string | null;
  elevation: number | null; count: number | null; score: number | null; difficulty: number | null;
  fields: string | null; kind: CategoryKind;
};

/** What a set's count is of ("steps"), from what its exercise records; blank with no count. */
function countedBy(r: Row): string | null {
  const field = r.count === null ? null : fieldFor(parseFields(r.fields, r.kind), 'count');
  return field ? FIELDS[field].noun ?? null : null;
}

export async function buildExport(
  db: Db,
  opts: ExportOptions,
): Promise<{ csv: string; rows: Record<string, unknown>[] }> {
  if (!opts.fields.length) throw new Error('Select at least one field to export');

  // Logged sets are always exported; a rest day's unlogged sets never are.
  const where: string[] = [opts.includeUnlogged ? `(w.is_rest = 0 OR ${LOGGED_SET})` : LOGGED_SET];
  const params: unknown[] = [];
  if (opts.dates) {
    if (!opts.dates.length) where.push('0');
    else {
      where.push(`w.date IN (${opts.dates.map(() => '?').join(',')})`);
      params.push(...opts.dates);
    }
  } else {
    if (opts.from) { where.push('w.date >= ?'); params.push(opts.from); }
    if (opts.to) { where.push('w.date <= ?'); params.push(opts.to); }
  }

  const data = await db.getAllAsync<Row>(
    `SELECT w.date, c.name AS category, e.subcategory, e.name AS exercise, s.set_number, s.reps, s.weight,
            s.duration_min, s.distance, s.elevation, s.count, s.score, s.difficulty, s.completed, w.notes,
            e.fields, c.kind
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     JOIN categories c ON c.id = e.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY w.date, we.position, we.id, s.set_number`,
    params,
  );

  const units = await getUnits(db);
  const rows = data.map((r) => ({
    date: r.date,
    weekday: WEEKDAYS[parseDateKey(r.date).getDay()],
    category: r.category,
    subcategory: r.subcategory,
    exercise: r.exercise,
    set: r.set_number,
    reps: r.reps,
    weight: toDisplayWeight(r.weight, units.weight),
    duration_min: r.duration_min === null ? null : roundMinutes(r.duration_min),
    distance: toDisplayDistance(r.distance, units.distance),
    elevation: toDisplayElevation(r.elevation, units.distance),
    count: r.count,
    count_of: countedBy(r),
    score: r.score,
    difficulty: r.difficulty,
    completed: !!r.completed,
    notes: r.notes,
  }));

  const unitOf: Partial<Record<ExportFieldKey, string>> = {
    weight: units.weight, distance: units.distance, elevation: elevationUnit(units.distance),
  };
  const columns: CsvColumn[] = EXPORT_FIELDS.filter((f) => opts.fields.includes(f.key)).map((f) => ({
    key: f.key,
    header: unitOf[f.key] ? `${f.header} (${unitOf[f.key]})` : f.header,
  }));
  return { csv: toCsv(columns, rows), rows };
}

export function exportFileName(opts: Pick<ExportOptions, 'dates' | 'from' | 'to'>): string {
  if (opts.dates?.length) {
    const sorted = [...opts.dates].sort();
    const [a, b] = [sorted[0], sorted[sorted.length - 1]];
    return a === b ? `lockin-${a}.csv` : `lockin-${a}_to_${b}.csv`;
  }
  if (opts.from && opts.to) return `lockin-${opts.from}_to_${opts.to}.csv`;
  return 'lockin-all.csv';
}
