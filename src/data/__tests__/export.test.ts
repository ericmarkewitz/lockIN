import { EXPORT_FIELDS, buildExport, exportFileName } from '../export';
import { setPlanDay } from '../plan';
import { ensureWorkout, setRestDay, setWorkoutNotes, updateSet } from '../workouts';
import { findByName } from '@/test/helpers';
import { createTestDb } from '@/test/testDb';
import type { Db } from '@/db/types';

async function seeded(): Promise<Db> {
  const db = await createTestDb();
  const bench = await findByName(db, 'Bench Press');
  const run = await findByName(db, 'Running');
  await setPlanDay(db, 1, { isRest: false, items: [{ exerciseId: bench, targetSets: 2, targetReps: 10 }] });
  await setPlanDay(db, 3, { isRest: false, items: [{ exerciseId: run, targetDurationMin: 30, targetDistance: 3 }] });
  const mon = await ensureWorkout(db, '2026-10-26');
  await updateSet(db, mon.exercises[0].sets[0].id, { weight: 135, reps: 10, completed: true });
  await updateSet(db, mon.exercises[0].sets[1].id, { weight: 145, reps: 8, completed: true });
  const wed = await ensureWorkout(db, '2026-10-28');
  await updateSet(db, wed.exercises[0].sets[0].id, { durationMin: 31, distance: 3.2, completed: true });
  await ensureWorkout(db, '2026-11-02'); // untouched Monday
  return db;
}

const allFields = EXPORT_FIELDS.map((f) => f.key);

describe('buildExport', () => {
  it('exports one row per logged set across all dates, skipping unlogged sets', async () => {
    const db = await seeded();
    const { rows } = await buildExport(db, { fields: allFields });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({ date: '2026-10-26', category: 'Lifts', exercise: 'Bench Press', set: 1, weight: 135, reps: 10 });
    expect(rows[2]).toMatchObject({ date: '2026-10-28', category: 'Cardio', exercise: 'Running', duration_min: 31, distance: 3.2 });
  });

  it('can include unlogged sets', async () => {
    const db = await seeded();
    const { rows } = await buildExport(db, { fields: allFields, includeUnlogged: true });
    expect(rows).toHaveLength(5); // 3 logged + the 2 unlogged sets of the untouched Monday
  });

  it('filters by date range (inclusive)', async () => {
    const db = await seeded();
    const { rows } = await buildExport(db, { fields: allFields, from: '2026-10-27', to: '2026-10-28' });
    expect(rows.map((r) => r.date)).toEqual(['2026-10-28']);
  });

  it('filters by an explicit list of dates', async () => {
    const db = await seeded();
    const { rows } = await buildExport(db, { fields: allFields, dates: ['2026-10-26'] });
    expect(rows).toHaveLength(2);
  });

  it('includes only the selected fields, in canonical order', async () => {
    const db = await seeded();
    const { csv } = await buildExport(db, { fields: ['weight', 'date', 'exercise'] });
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toBe('Date,Exercise,Weight (lb)');
    expect(lines[1]).toBe('2026-10-26,Bench Press,135');
  });

  it('uses the configured weight unit in the header', async () => {
    const db = await seeded();
    await db.runAsync("UPDATE settings SET value = 'kg' WHERE key = 'weight_unit'");
    const { csv } = await buildExport(db, { fields: ['weight'] });
    expect(csv.split('\r\n')[0]).toBe('Weight (kg)');
  });

  it('includes notes and weekday, and skips rest days', async () => {
    const db = await seeded();
    await setWorkoutNotes(db, '2026-10-26', 'Felt strong, "PR" attempt');
    await setRestDay(db, '2026-10-30', true);
    const { rows } = await buildExport(db, { fields: allFields });
    expect(rows[0]).toMatchObject({ weekday: 'Monday', notes: 'Felt strong, "PR" attempt' });
    expect(rows.some((r) => r.date === '2026-10-30')).toBe(false);
  });

  it('returns a header-only CSV when nothing matches', async () => {
    const db = await seeded();
    const { csv, rows } = await buildExport(db, { fields: ['date', 'exercise'], from: '2020-01-01', to: '2020-01-02' });
    expect(rows).toEqual([]);
    expect(csv).toBe('Date,Exercise\r\n');
  });

  it('requires at least one field', async () => {
    const db = await seeded();
    await expect(buildExport(db, { fields: [] })).rejects.toThrow(/field/i);
  });
});

describe('exportFileName', () => {
  it('names by range', () => {
    expect(exportFileName({})).toBe('lockin-all.csv');
    expect(exportFileName({ from: '2026-10-01', to: '2026-10-31' })).toBe('lockin-2026-10-01_to_2026-10-31.csv');
    expect(exportFileName({ dates: ['2026-10-05'] })).toBe('lockin-2026-10-05.csv');
    expect(exportFileName({ dates: ['2026-10-05', '2026-10-09'] })).toBe('lockin-2026-10-05_to_2026-10-09.csv');
  });
});
