import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getAllSetLogs } from '../db';
import { DAYS_LONG, toISO, weekdayIndex } from './dates';

const esc = (v: string | number) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export type ExportResult = 'shared' | 'empty' | 'unavailable';

/** Writes every logged set to a CSV in the cache folder and opens the share sheet. */
export async function exportCsv(): Promise<ExportResult> {
  const rows = await getAllSetLogs();
  if (rows.length === 0) return 'empty';

  const lines = [
    ['date', 'day', 'exercise', 'muscle', 'set', 'reps', 'weight_lb'],
    ...rows.map((r) => [
      r.date,
      DAYS_LONG[weekdayIndex(r.date)],
      r.exercise,
      r.muscle,
      r.setNumber,
      r.reps,
      r.weight,
    ]),
  ];
  const csv = lines.map((l) => l.map(esc).join(',')).join('\n') + '\n';

  const file = new File(Paths.cache, `lockin-export-${toISO(new Date())}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(csv);

  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    dialogTitle: 'Export workouts',
    UTI: 'public.comma-separated-values-text',
  });
  return 'shared';
}
