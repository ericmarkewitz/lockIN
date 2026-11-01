import type { Db } from '@/db/types';
import { parseDateKey } from '@/lib/dates';
import { toCsv, type CsvColumn } from './csv';

export type ExportFieldKey =
  | 'date' | 'weekday' | 'category' | 'exercise' | 'set' | 'reps' | 'weight'
  | 'duration_min' | 'distance' | 'completed' | 'notes';

/** Canonical column order. The weight header gets the user's unit appended. */
export const EXPORT_FIELDS: { key: ExportFieldKey; header: string; label: string }[] = [
  { key: 'date', header: 'Date', label: 'Date' },
  { key: 'weekday', header: 'Weekday', label: 'Weekday' },
  { key: 'category', header: 'Category', label: 'Category' },
  { key: 'exercise', header: 'Exercise', label: 'Exercise' },
  { key: 'set', header: 'Set', label: 'Set number' },
  { key: 'reps', header: 'Reps', label: 'Reps' },
  { key: 'weight', header: 'Weight', label: 'Weight' },
  { key: 'duration_min', header: 'Duration (min)', label: 'Duration' },
  { key: 'distance', header: 'Distance', label: 'Distance' },
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
  date: string; category: string; exercise: string; set_number: number; reps: number | null;
  weight: number | null; duration_min: number | null; distance: number | null; completed: number; notes: string | null;
};

export async function buildExport(
  db: Db,
  opts: ExportOptions,
): Promise<{ csv: string; rows: Record<string, unknown>[] }> {
  if (!opts.fields.length) throw new Error('Select at least one field to export');

  const where: string[] = ['w.is_rest = 0'];
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
  if (!opts.includeUnlogged) {
    where.push('(s.completed = 1 OR s.reps IS NOT NULL OR s.weight IS NOT NULL OR s.duration_min IS NOT NULL OR s.distance IS NOT NULL)');
  }

  const data = await db.getAllAsync<Row>(
    `SELECT w.date, c.name AS category, e.name AS exercise, s.set_number, s.reps, s.weight,
            s.duration_min, s.distance, s.completed, w.notes
     FROM sets s
     JOIN workout_exercises we ON we.id = s.workout_exercise_id
     JOIN workouts w ON w.id = we.workout_id
     JOIN exercises e ON e.id = we.exercise_id
     JOIN categories c ON c.id = e.category_id
     WHERE ${where.join(' AND ')}
     ORDER BY w.date, we.position, we.id, s.set_number`,
    params,
  );

  const rows = data.map((r) => ({
    date: r.date,
    weekday: WEEKDAYS[parseDateKey(r.date).getDay()],
    category: r.category,
    exercise: r.exercise,
    set: r.set_number,
    reps: r.reps,
    weight: r.weight,
    duration_min: r.duration_min,
    distance: r.distance,
    completed: !!r.completed,
    notes: r.notes,
  }));

  const unit = (await db.getFirstAsync<{ value: string }>("SELECT value FROM settings WHERE key = 'weight_unit'"))?.value ?? 'lb';
  const columns: CsvColumn[] = EXPORT_FIELDS.filter((f) => opts.fields.includes(f.key)).map((f) => ({
    key: f.key,
    header: f.key === 'weight' ? `Weight (${unit})` : f.header,
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
